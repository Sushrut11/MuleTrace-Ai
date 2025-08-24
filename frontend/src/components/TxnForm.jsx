import React, { useState, useEffect } from "react";
import api from "../api/apiConfig";
import "../App.css";

const TxnForm = () => {
    const [txnId, setTxnId] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isMined, setIsMined] = useState(false);
    const [txHash, setTxHash] = useState(null);

    useEffect(() => {
        let pollInterval;
        if (txHash && !isMined) {
            pollInterval = setInterval(async () => {
                try {
                    const res = await api.get(`/txn_status/${txHash}`);
                    if (res.data.mined) {
                        setIsMined(true);
                        clearInterval(pollInterval);
                    }
                } catch (e) {
                    // Ignore polling errors
                }
            }, 5000);
        }
        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [txHash, isMined]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);
        setIsMined(false);
        setTxHash(null);

        try {
            if (!/^[CM]\d+$/.test(txnId)) {
                throw new Error("ID must start with 'C' or 'M' followed by numbers");
            }

            const response = await api.post("/check_txn", { txn_id: txnId });
            setResult(response.data);

            if (response.data.blockchain_tx_hash) {
                setTxHash(response.data.blockchain_tx_hash.startsWith("0x")
                    ? response.data.blockchain_tx_hash
                    : "0x" + response.data.blockchain_tx_hash
                );
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || "Transaction check failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-container">
            <h3>Check Transaction</h3>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Enter Transaction ID (e.g., C1231006815)"
                    value={txnId}
                    onChange={(e) => setTxnId(e.target.value)}
                />
                <button type="submit" disabled={loading}>
                    {loading ? "Checking..." : "Check"}
                </button>
            </form>

            {error && <div className="error-message">{error}</div>}
            
            {result && (
                <div className={`result-box ${result.fraud ? "fraud" : "legit"}`}>
                    <span><strong>Status:</strong> {result.fraud ? "⚠️ Fraudulent" : "✅ Legitimate"}</span>
                    <span><strong>Confidence:</strong> {(result.confidence * 100).toFixed(2)}%</span>
                    {txHash && (
                        <span>
                            <strong>Blockchain Link:</strong>{" "}
                            {isMined ? (
                                <a
                                    href={`https://sepolia.etherscan.io/tx/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    View on Blockchain
                                </a>
                            ) : (
                                <span style={{ color: "#aaa" }}>Waiting for mining...</span>
                            )}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default TxnForm;
