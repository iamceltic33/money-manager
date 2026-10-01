"""Prepare a validated, account-scoped replacement SQL; never connects to Supabase."""
import argparse
from datetime import datetime
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import sqlite3
import tempfile
from uuid import UUID, uuid5
import zipfile
from zoneinfo import ZoneInfo


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sql_literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def snapshot_sql(user_id):
    owner = sql_literal(user_id)
    parts = []
    for table in ('profiles', 'categories', 'transactions', 'budgets'):
        column = 'id' if table == 'profiles' else 'user_id'
        parts.append(f"'{table}', (select coalesce(jsonb_agg(r order by id), '[]') from public.{table} r where {column}={owner}::uuid)")
    return 'jsonb_build_object(' + ',\n'.join(parts) + ')'


def apply_annotations(path, payload, summary, mapped_id):
    portable = json.loads(Path(path).read_text())
    metadata = portable['metadata']
    require(metadata['source_sha256'] == summary['source_sha256'], 'Source backup differs from annotated data')
    require(metadata['timezone'] == summary['timezone'], 'Annotated timezone differs')
    require(metadata['currency'] == summary['currency'], 'Annotated currency differs')
    require(not metadata.get('needs_review'), 'Annotated data still needs review')
    for table, entity in (('categories', 'category'), ('transactions', 'transaction')):
        annotations = portable[table]
        by_id = {mapped_id(entity, row['source_uid']): row for row in annotations}
        require(len(by_id) == len(annotations), 'Duplicate annotated source IDs')
        require(set(by_id) == {row['id'] for row in payload[table]}, 'Annotated records differ: ' + table)
        for row in payload[table]:
            annotated = by_id[row['id']]
            for key, value in row.items():
                if key in ('id', 'user_id', 'exclude_from_average'):
                    continue
                expected = annotated.get(key)
                if key == 'category_id':
                    source_category = annotated['source_category_uid']
                    expected = mapped_id('category', source_category) if source_category else None
                require(value == expected, 'Annotated content differs: ' + table + '.' + key)
            flag = annotated['exclude_from_average']
            require(isinstance(flag, bool), 'Invalid exclusion flag')
            row['exclude_from_average'] = flag
    summary['annotations_sha256'] = hashlib.sha256(Path(path).read_bytes()).hexdigest()


def prepare(args):
    user_id = str(UUID(args.user_id))
    namespace = UUID(user_id)
    zone = ZoneInfo(args.timezone)
    backup = json.loads(Path(args.cloud_backup).read_text())['rows'][0]
    previous = backup['data']
    require(len(previous['profiles']) == 1 and previous['profiles'][0]['id'] == user_id, 'Backup belongs to another account')
    require(not previous['budgets'], 'Budgets need a separate migration plan')
    for table in ('categories', 'transactions'):
        require(all(r['user_id'] == user_id for r in previous[table]), 'Backup owner mismatch')
    mapped_id = lambda entity, uid: str(uuid5(namespace, f'money-manager/android/{entity}/{uid}'))
    kinds = {'Expense': 'expense', 'Income': 'income'}
    icons = {'education': 'education', 'sport': 'sport', 'present': 'gift', 'heart': 'health', 'bank': 'bank', 'bill': 'receipt', 'prepaid': 'salary', 'couple': 'people', 'transport': 'transport', 'home': 'home', 'family': 'people', 'products': 'shopping', 'cafe': 'coffee', 'purse': 'cash'}
    with tempfile.TemporaryDirectory(prefix='mm-import-') as temporary:
        source = Path(temporary) / 'source.db'
        with zipfile.ZipFile(args.backup) as archive:
            source.write_bytes(archive.read('MyFinance.db'))
        db = sqlite3.connect(f'{source.as_uri()}?mode=ro', uri=True)
        db.row_factory = sqlite3.Row
        require(db.execute('pragma quick_check').fetchone()[0] == 'ok', 'Corrupt source database')
        rows = lambda table: list(db.execute(f'SELECT * FROM "{table}" WHERE isRemoved=0 ORDER BY uid'))
        accounts = rows('account')
        require(len(accounts) == 1 and accounts[0]['currencyCode'] == 'KZT' and not accounts[0]['ignoreInBalance'], 'Only one included KZT account is supported')
        require(not rows('transfer'), 'Transfers need a separate migration plan')
        categories = []
        category_types = {}
        for row in rows('category'):
            require(row['type'] in kinds and bool(row['title']), 'Invalid category')
            category_types[row['uid']] = row['type']
            categories.append(dict(id=mapped_id('category', row['uid']), user_id=user_id, name=row['title'], type=kinds[row['type']], color=f"#{row['color'] & 0xffffff:06X}" if row['color'] is not None else None, icon=icons.get(row['icon'], 'receipt'), sort_order=row['position'] or 0, created_at=row['created'], updated_at=row['modified'], exclude_from_average=False))
        require(len({(c['name'], c['type']) for c in categories}) == len(categories), 'Duplicate category names')
        links = {}
        account_links = {}
        for row in db.execute("SELECT * FROM sync_link WHERE isRemoved=0 AND entityType='Transaction'"):
            if row['otherType'] == 'Category':
                links.setdefault(row['entityUid'], []).append(row['otherUid'])
            elif row['otherType'] == 'Account':
                account_links.setdefault(row['entityUid'], []).append(row['otherUid'])
        totals = {'income': 0, 'expense': 0}
        transactions = []
        for row in rows('transaction'):
            require(row['type'] in kinds, 'Unsupported transaction type')
            require(account_links.get(row['uid']) == [accounts[0]['uid']], 'Missing or ambiguous account')
            require(row['accountCurrencyCode'] == 'KZT' and row['realCurrencyCode'] in (None, 'KZT'), 'Unsupported currency')
            amount = row['amountInAccountCurrency']
            require(isinstance(amount, int) and 0 < amount < 10**14 and amount == row['amountInDefaultCurrency'], 'Invalid or inconsistent amount')
            category = links.get(row['uid'], [])
            require(len(category) <= 1, 'Ambiguous category')
            if category:
                require(category_types.get(category[0]) == row['type'], 'Missing category or mismatched type')
            date = datetime.strptime(row['date'], '%Y-%m-%d').replace(tzinfo=zone).isoformat()
            kind = kinds[row['type']]
            totals[kind] += amount
            transactions.append(dict(id=mapped_id('transaction', row['uid']), user_id=user_id, category_id=mapped_id('category', category[0]) if category else None, type=kind, amount=str(Decimal(amount) / 100), note=row['comment'], occurred_at=date, created_at=row['created'], updated_at=row['modified'], exclude_from_average=False))
        balance = totals['income'] - totals['expense']
        account_balance = db.execute('SELECT value FROM account_balance WHERE uid=?', (accounts[0]['uid'],)).fetchone()
        require(account_balance is not None and balance == account_balance[0], 'Transaction balance does not match source account')
        db.close()
    payload = dict(categories=categories, transactions=transactions)
    summary = dict(categories=len(categories), transactions=len(transactions), income_count=sum(t['type'] == 'income' for t in transactions), expense_count=sum(t['type'] == 'expense' for t in transactions), uncategorized=sum(t['category_id'] is None for t in transactions), income=str(Decimal(totals['income']) / 100), expense=str(Decimal(totals['expense']) / 100), balance=str(Decimal(balance) / 100), currency='KZT', timezone=args.timezone, source_sha256=hashlib.sha256(Path(args.backup).read_bytes()).hexdigest())
    if args.data:
        apply_annotations(args.data, payload, summary, mapped_id)
    summary['excluded_category_count'] = sum(c['exclude_from_average'] for c in categories)
    summary['excluded_transaction_count'] = sum(t['exclude_from_average'] for t in transactions)
    summary['excluded_expense_amount'] = str(sum((Decimal(t['amount']) for t in transactions if t['type'] == 'expense' and t['exclude_from_average']), Decimal(0)))
    owner = sql_literal(user_id)
    sql = f"""BEGIN;
SET LOCAL standard_conforming_strings = on;
SET LOCAL lock_timeout = '10s';
LOCK TABLE public.profiles, public.categories, public.transactions, public.budgets IN SHARE ROW EXCLUSIVE MODE;
DO $guard$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id={owner}::uuid AND lower(email)=lower({sql_literal(args.email)})) THEN
  RAISE EXCEPTION 'Account identity mismatch';
 END IF;
 IF md5(({snapshot_sql(user_id)})::text) <> {sql_literal(backup['fingerprint'])} THEN
  RAISE EXCEPTION 'Cloud data changed since backup; refusing replacement';
 END IF;
END $guard$;
DELETE FROM public.transactions WHERE user_id={owner}::uuid;
DELETE FROM public.categories WHERE user_id={owner}::uuid;
"""
    for table in ('categories', 'transactions'):
        require(bool(payload[table]), f'Empty {table}; refusing replacement')
        columns = ', '.join(payload[table][0])
        data = sql_literal(json.dumps(payload[table], ensure_ascii=False))
        sql += f'INSERT INTO public.{table} ({columns}) SELECT {columns} FROM jsonb_populate_recordset(NULL::public.{table}, {data}::jsonb);\n'
    sql += f"""UPDATE public.profiles SET currency='KZT', data_initialized_at=coalesce(data_initialized_at, now()) WHERE id={owner}::uuid;
DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.categories WHERE user_id={owner}::uuid) <> {len(categories)}
 OR (SELECT count(*) FROM public.transactions WHERE user_id={owner}::uuid) <> {len(transactions)}
 OR (SELECT sum(CASE WHEN type='income' THEN amount ELSE -amount END) FROM public.transactions WHERE user_id={owner}::uuid) <> {summary['balance']}
 OR (SELECT count(*) FROM public.transactions WHERE user_id={owner}::uuid AND exclude_from_average) <> {summary['excluded_transaction_count']}
 OR (SELECT count(*) FROM public.categories WHERE user_id={owner}::uuid AND exclude_from_average) <> {summary['excluded_category_count']} THEN
  RAISE EXCEPTION 'Import verification failed';
 END IF;
END $verify$;
COMMIT;
"""
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    for name, content in [('payload.json', json.dumps(payload, ensure_ascii=False, indent=2)), ('summary.json', json.dumps(summary, ensure_ascii=False, indent=2)), ('import.sql', sql)]:
        path = output / name
        with path.open('x') as handle:
            path.chmod(0o600)
            handle.write(content + '\n')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('backup')
    parser.add_argument('--data', help='Annotated portable JSON; validates source and preserves exclusion flags')
    parser.add_argument('--user-id', required=True)
    parser.add_argument('--email', required=True)
    parser.add_argument('--cloud-backup', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--timezone', default='Asia/Almaty')
    prepare(parser.parse_args())
