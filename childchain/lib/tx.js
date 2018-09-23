const RLP = require('rlp');
const crypto = require('crypto');
const utils = require('ethereumjs-util');

class Asset {
  constructor(assetId, amount) {
    this.assetId = assetId;
    this.amount = amount;
  }

  getTuple() {
    return [this.assetId, this.amount];
  }

  getBytes() {
    return RLP.encode(this.getTuple());
  }

  static fromTuple(decoded) {
    return new Asset(decoded[0], decoded[1]);
  }

  clone() {
    return new Asset(this.assetId, this.amount);
  }

}

const zeroAddress = new Buffer("0000000000000000000000000000000000000000", 'hex');

class TransactionOutput {
  constructor(owners, value, state) {
    // addresses, tx need their signatures
    this.owners = owners || [];
    // values
    this.value = value;
    // contract address include verification function, 20byte
    this.contract = 0;
    // state in bytes
    this.state = state || [];
  }

  getTuple() {
    return [
      this.owners,
      this.value.getTuple(),
      this.contract,
      this.state
    ]
  }

  getBytes() {
    return RLP.encode(this.getTuple());
  }

  static fromTuple(decoded) {
    return new TransactionOutput(
      decoded[0],
      Asset.fromTuple(decoded[1]),
      decoded[3],
      decoded[4]
    );
  }

  hash() {
    const hash = crypto.createHash('sha256');
    hash.update(this.getBytes());
    return hash.digest('hex');
  }

  clone() {
    return new TransactionOutput(
      [].concat(this.owners),
      this.value.clone(),
      [].concat(this.state)
    )
  }

}

class Transaction {
  
  constructor(label, args, nonce, inputs, outputs) {
    // arguments for tx, first argument is function label
    this.label = label;
    this.args = args || []
    // inputs UTXO
    this.inputs = inputs || [];
    // outputs UTXO
    this.outputs = outputs || [];
    // hash of tx, 32byte
    this.nonce = nonce;
    this.id = this.hash();
    // signatures
    this.sigs = [];
  }

  getBytes() {
    const data = [
      0,
      this.label,
      this.args,
      this.inputs.map(i => i.getTuple()),
      this.outputs.map(o => o.getTuple()),
      this.nonce
    ];
    return RLP.encode(data);
  }

  static fromBytes(data) {
    const decoded = RLP.decode(data);
    return new Transaction(
      decoded[1],
      decoded[2],
      decoded[5],
      decoded[3].map(d => TransactionOutput.fromTuple(d)),
      decoded[4].map(d => TransactionOutput.fromTuple(d))
    );
  }

  sign(privKey) {
    const sign = utils.ecsign(new Buffer(this.hash(), 'hex'), privKey);
    const signBuffer = Buffer.concat([sign.r, sign.s, Buffer.from([sign.v])], 65);
    return signBuffer;
  }

  getOwners() {
    return this.inputs.reduce((owners, i) => {
      return owners.concat(i.owners);
    }, []);
  }

  checkSigns() {
    const owners = this.getOwners();
    if(this.sigs.length != owners.length) {
      throw new Error('signatures not enough');
    }
  }

  /**
   * @dev merkleHash is hash(hash(tx) + sigs).
   * sigs are signatures of all inputs owners.
   */
  merkleHash() {
    this.checkSigns();
    const txHash = this.hash();
    const hash = crypto.createHash('sha256');
    hash.update(new Buffer(txHash, 'hex'));
    hash.update(Buffer.concat(this.sigs));
    return hash.digest('hex');
  }

  hash() {
    const hash = crypto.createHash('sha256');
    hash.update(this.getBytes());
    return hash.digest('hex');
  }

}

module.exports = {
  Asset,
  Transaction,
  TransactionOutput
}
