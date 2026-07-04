/**
 * OutreachRecord 合约 ABI（由 Solidity 0.8.24 编译生成）
 *
 * 部署到 TRON Nile 测试网后，将合约地址填入 CONTRACTS.OutreachRecord。
 */
export const OUTREACH_RECORD_ABI = [
  // 构造函数
  { type: 'constructor', inputs: [], stateMutability: 'nonpayable' },

  // 状态变量
  { type: 'function', name: 'outreachCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'outreaches', inputs: [{ type: 'string' }], outputs: [
    { type: 'string', name: 'outreachId' },
    { type: 'string', name: 'university' },
    { type: 'string', name: 'eventId' },
    { type: 'bytes32', name: 'emailHash' },
    { type: 'bytes32', name: 'replyHash' },
    { type: 'uint8', name: 'replyIntent' },
    { type: 'uint256', name: 'sentAt' },
    { type: 'uint256', name: 'repliedAt' },
    { type: 'address', name: 'recordedBy' },
    { type: 'bool', name: 'exists' },
  ], stateMutability: 'view' },
  { type: 'function', name: 'outreachIds', inputs: [{ type: 'uint256' }], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'recorders', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },

  // 写方法
  { type: 'function', name: 'setRecorder', inputs: [
    { type: 'address', name: 'account' },
    { type: 'bool', name: 'authorized' },
  ], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'recordOutreach', inputs: [
    { type: 'string', name: 'outreachId' },
    { type: 'string', name: 'university' },
    { type: 'string', name: 'eventId' },
    { type: 'bytes32', name: 'emailHash' },
  ], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'recordReply', inputs: [
    { type: 'string', name: 'outreachId' },
    { type: 'bytes32', name: 'replyHash' },
    { type: 'uint8', name: 'replyIntent' },
  ], outputs: [], stateMutability: 'nonpayable' },

  // 事件
  { type: 'event', name: 'OutreachSent', inputs: [
    { type: 'string', name: 'outreachId', indexed: true },
    { type: 'string', name: 'university' },
    { type: 'bytes32', name: 'emailHash' },
    { type: 'uint256', name: 'sentAt' },
  ] },
  { type: 'event', name: 'ReplyReceived', inputs: [
    { type: 'string', name: 'outreachId', indexed: true },
    { type: 'bytes32', name: 'replyHash' },
    { type: 'uint8', name: 'replyIntent' },
    { type: 'uint256', name: 'repliedAt' },
  ] },
] as const;
