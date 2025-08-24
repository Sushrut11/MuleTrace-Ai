from flask import Flask, request, jsonify
from dotenv import load_dotenv
from flask_cors import CORS
import pandas as pd
import joblib
import os
from werkzeug.utils import secure_filename
import hashlib
from web3 import Web3
import random
import threading

# ====================
# Flask & CORS Setup
# ====================
app = Flask(__name__)
CORS(app, resources={
    r"/check_txn": {
        "origins": "http://localhost:5173",
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    },
    r"/upload_csv": {
        "origins": "http://localhost:5173",
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB limit

# ====================
# Model Loading
# ====================
try:
    model = joblib.load('model.pkl')
    df = pd.read_csv('Synthetic_Financial_datasets_log.csv')
    print("✅ Model and data loaded successfully")
except Exception as e:
    print(f"❌ Error loading model/data: {str(e)}")
    exit(1)

# ====================
# Blockchain Setup
# ====================

load_dotenv()

web3_provider = os.getenv("WEB3_PROVIDER")
contract_address = os.getenv("CONTRACT_ADDRESS")
private_key = os.getenv("PRIVATE_KEY")
wallet_address = os.getenv("WALLET_ADDRESS")  

web3 = Web3(Web3.HTTPProvider(web3_provider))

abi = [
    {
        "inputs": [
            {"internalType": "string", "name": "txnHash", "type": "string"},
            {"internalType": "string", "name": "fraudStatus", "type": "string"},
            {"internalType": "string", "name": "reason", "type": "string"}
        ],
        "name": "logTransaction",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

contract = web3.eth.contract(address=contract_address, abi=abi)

def hash_transaction(transaction):
    txn_string = f"{transaction['transaction_id']}{transaction['sender_id']}{transaction['receiver_id']}{transaction['amount']}{transaction['fraud_status']}{transaction['reason']}"
    return hashlib.sha256(txn_string.encode()).hexdigest()

def log_to_blockchain(txn_hash, fraud_status, reason):
    try:
        nonce = web3.eth.get_transaction_count(wallet_address)
        
        # Increase gas price slightly to ensure faster mining
        gas_price = web3.eth.gas_price
        gas_price = int(gas_price * 1.1)  # 10% higher than current gas price
        
        tx = contract.functions.logTransaction(txn_hash, fraud_status, reason).build_transaction({
            'from': wallet_address,
            'nonce': nonce,
            'gas': 200000,
            'gasPrice': gas_price
        })
        
        signed_tx = web3.eth.account.sign_transaction(tx, private_key=private_key)
        tx_hash = web3.eth.send_raw_transaction(signed_tx.raw_transaction)
        
        # Wait for the transaction to be mined with timeout
        try:
            receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            print(f"Transaction mined in block: {receipt.blockNumber}")
            return web3.to_hex(tx_hash)
        except Exception as e:
            print(f"Transaction submitted but not confirmed yet: {str(e)}")
            return web3.to_hex(tx_hash)
            
    except Exception as e:
        print(f"Error submitting transaction: {str(e)}")
        return None

def prepare_features(transaction):
    txn_type = transaction['type'].values[0]
    return [
        transaction['amount'].values[0],
        transaction['oldbalanceOrg'].values[0],
        transaction['newbalanceOrig'].values[0],
        transaction['oldbalanceDest'].values[0],
        transaction['newbalanceDest'].values[0],
        1 if txn_type == 'TRANSFER' else 0,
        1 if txn_type == 'CASH_OUT' else 0,
        1 if txn_type == 'DEBIT' else 0,
        1 if txn_type == 'PAYMENT' else 0
    ]

# ====================
# API Endpoints
# ====================

@app.route('/txn_status/<tx_hash>', methods=['GET'])
def txn_status(tx_hash):
    try:
        receipt = web3.eth.get_transaction_receipt(tx_hash)
        if receipt and receipt['blockNumber']:
            return jsonify({"mined": True, "blockNumber": receipt['blockNumber']})
        else:
            return jsonify({"mined": False})
    except Exception as e:
        # If not found, web3 throws an error, so we return not mined
        return jsonify({"mined": False})

@app.route('/check_txn', methods=['POST', 'OPTIONS'])
def check_txn():
    if request.method == 'OPTIONS':
        return jsonify(), 200

    try:
        data = request.get_json()
        if not data or 'txn_id' not in data:
            return jsonify({"error": "Missing transaction ID"}), 400

        txn_id = data['txn_id'].strip()
        if not txn_id.startswith(('C', 'M')):
            return jsonify({"error": "Invalid transaction ID format"}), 400

        transaction = df[df['nameOrig'] == txn_id].iloc[0:1]
        if transaction.empty:
            return jsonify({"error": "Transaction not found"}), 404

        # Prepared features as a DataFrame with correct columns
        feature_columns = [
            'amount',
            'oldbalanceOrg',
            'newbalanceOrig',
            'oldbalanceDest',
            'newbalanceDest',
            'type_TRANSFER',
            'type_CASH_OUT',
            'type_DEBIT',
            'type_PAYMENT'
        ]
        txn_type = transaction['type'].values[0]
        features_dict = {
            'amount': transaction['amount'].values[0],
            'oldbalanceOrg': transaction['oldbalanceOrg'].values[0],
            'newbalanceOrig': transaction['newbalanceOrig'].values[0],
            'oldbalanceDest': transaction['oldbalanceDest'].values[0],
            'newbalanceDest': transaction['newbalanceDest'].values[0],
            'type_TRANSFER': 1 if txn_type == 'TRANSFER' else 0,
            'type_CASH_OUT': 1 if txn_type == 'CASH_OUT' else 0,
            'type_DEBIT': 1 if txn_type == 'DEBIT' else 0,
            'type_PAYMENT': 1 if txn_type == 'PAYMENT' else 0
        }
        features_df = pd.DataFrame([features_dict])

        prediction = model.predict(features_df)[0]
        probability = model.predict_proba(features_df)[0][1]

        fraud_status = "Fraudulent" if bool(prediction) else "Legitimate"
        reason = f"Confidence: {int(probability * 100)}%"

        transaction_data = {
            'transaction_id': txn_id,
            'sender_id': txn_id,
            'receiver_id': transaction['nameDest'].values[0],
            'amount': transaction['amount'].values[0],
            'fraud_status': fraud_status,
            'reason': reason,
        }

        txn_hash = hash_transaction(transaction_data)
        blockchain_txn_hash = log_to_blockchain(txn_hash, fraud_status, reason)

        return jsonify({
            **transaction_data,
            "hashed_value": txn_hash,
            "blockchain_link": f"https://sepolia.etherscan.io/tx/{blockchain_txn_hash}",
            "blockchain_tx_hash": blockchain_txn_hash,  
            "fraud": bool(prediction),
            "confidence": float(probability)
        })

    except Exception as e:
        return jsonify({"error": f"Processing error: {str(e)}"}), 500
   
@app.route('/upload_csv', methods=['POST', 'OPTIONS'])
def upload_csv():
    if request.method == 'OPTIONS':
        return jsonify(), 200

    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        if not file or file.filename == '':
            return jsonify({"error": "Empty file"}), 400

        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        batch_df = pd.read_csv(filepath)
        results = []

        for _, row in batch_df.iterrows():
            try:
                is_fraud = bool(row['isFraud'])
                reason_options = []
                if is_fraud:
                    if row['amount'] > 50000:
                        reason_options.append("High transaction amount")
                    if row['oldbalanceOrg'] == 0:
                        reason_options.append("Sender flagged due to zero balance")
                    if row['oldbalanceDest'] == 0:
                        reason_options.append("Receiver flagged due to zero balance")
                    reason_options.append("Suspicious activity detected")
                    reason = random.choice(reason_options)
                else:
                    reason = "Genuine Account/Wallet"

                transaction_data = {
                    'transaction_id': row['nameOrig'],
                    'sender_id': row['nameOrig'],
                    'receiver_id': row['nameDest'],
                    'amount': row['amount'],
                    'fraud_status': "Fraudulent" if is_fraud else "Legitimate",
                    'reason': reason,
                }

                if is_fraud:
                    txn_hash = hash_transaction(transaction_data)
                    blockchain_txn_hash = log_to_blockchain(txn_hash, transaction_data['fraud_status'], reason)
                    blockchain_link = f"https://sepolia.etherscan.io/tx/{blockchain_txn_hash}"
                else:
                    txn_hash = ""
                    blockchain_link = ""

                results.append({
                    **transaction_data,
                    "hashed_value": txn_hash,
                    "blockchain_link": blockchain_link
                })
            except Exception as e:
                results.append({
                    "transaction_id": row.get('nameOrig', ''),
                    "hashed_value": "",
                    "sender_id": row.get('nameOrig', ''),
                    "receiver_id": row.get('nameDest', ''),
                    "fraud_status": "Error",
                    "reason": f"Row processing failed: {str(e)}",
                    "blockchain_link": ""
                })

        return jsonify({"processed": len(results), "results": results})

    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

@app.route('/test', methods=['GET'])
def test():
    return jsonify({
        "status": "active",
        "model_ready": True,
        "data_samples": len(df),
    })

if __name__ == '__main__':
    app.run(port=5001, debug=True, host='0.0.0.0')
