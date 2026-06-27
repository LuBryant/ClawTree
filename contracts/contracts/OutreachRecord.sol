// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title OutreachRecord — 外联记录链上存证
/// @notice 将 ClawTree 的每一条智能外联（高校联系、邮件发送、回复解析）
///         的哈希锚定上链，形成可审计的沟通流水。
contract OutreachRecord {
    struct Outreach {
        string  outreachId;     // 外联唯一 ID
        string  university;     // 目标高校
        string  eventId;        // 关联活动 ID（可为空）
        bytes32 emailHash;      // 外联邮件内容哈希
        bytes32 replyHash;      // 回复内容哈希（可为空）
        uint8   replyIntent;    // 0=未回复 1=有意 2=拒绝 3=待定
        uint256 sentAt;         // 发送时间
        uint256 repliedAt;      // 回复时间（可为 0）
        address recordedBy;     // 记录者
        bool    exists;
    }

    uint256 public outreachCount;
    mapping(string => Outreach) public outreaches;       // outreachId → Outreach
    mapping(uint256 => string) public outreachIds;       // index → outreachId
    mapping(address => bool) public recorders;           // 授权记录者

    event OutreachSent(
        string indexed outreachId,
        string university,
        bytes32 emailHash,
        uint256 sentAt
    );

    event ReplyReceived(
        string indexed outreachId,
        bytes32 replyHash,
        uint8 replyIntent,
        uint256 repliedAt
    );

    modifier onlyRecorder() {
        require(recorders[msg.sender], "Not authorized recorder");
        _;
    }

    constructor() {
        recorders[msg.sender] = true;
    }

    function setRecorder(address account, bool authorized) external onlyRecorder {
        recorders[account] = authorized;
    }

    function recordOutreach(
        string calldata outreachId,
        string calldata university,
        string calldata eventId,
        bytes32 emailHash
    ) external onlyRecorder {
        require(!outreaches[outreachId].exists, "Outreach already recorded");
        require(bytes(outreachId).length > 0, "Empty outreachId");

        outreaches[outreachId] = Outreach({
            outreachId: outreachId,
            university: university,
            eventId: eventId,
            emailHash: emailHash,
            replyHash: bytes32(0),
            replyIntent: 0,
            sentAt: block.timestamp,
            repliedAt: 0,
            recordedBy: msg.sender,
            exists: true
        });
        outreachIds[outreachCount] = outreachId;
        outreachCount++;

        emit OutreachSent(outreachId, university, emailHash, block.timestamp);
    }

    function recordReply(
        string calldata outreachId,
        bytes32 replyHash,
        uint8 replyIntent
    ) external onlyRecorder {
        Outreach storage o = outreaches[outreachId];
        require(o.exists, "Outreach not found");
        require(replyIntent >= 1 && replyIntent <= 3, "Invalid intent (1=yes 2=no 3=pending)");

        o.replyHash = replyHash;
        o.replyIntent = replyIntent;
        o.repliedAt = block.timestamp;

        emit ReplyReceived(outreachId, replyHash, replyIntent, block.timestamp);
    }

    function getOutreach(string calldata outreachId) external view returns (Outreach memory) {
        require(outreaches[outreachId].exists, "Outreach not found");
        return outreaches[outreachId];
    }
}
