import { useState } from "react";

export function useAsync<T, ErrorType>(asyncFunc: () => Promise<T>) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<T>();
    const [error, setError] = useState<ErrorType | Error | unknown>();

    asyncFunc()
        .then(setData)
        .catch(setError)

    return {
        loading, data, error
    }    
}