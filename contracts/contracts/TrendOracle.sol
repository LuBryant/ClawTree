// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title TrendOracle — 趋势数据链上锚定
/// @notice ClawTree Agent 定期将高校活动趋势报告哈希锚定上链，
///         形成可验证的"趋势快照"，供前端趋势面板查询与历史回溯。
contract TrendOracle {
    struct TrendSnapshot {
        bytes32 reportHash;     // 趋势报告全文哈希（JSON 报告 → IPFS → 哈希上链）
        string  reportURI;      // IPFS/Arweave 报告链接
        uint256 periodStart;    // 统计周期起始
        uint256 periodEnd;      // 统计周期结束
        uint256 totalEvents;    // 聚合事件数
        uint256 activeOutreach; // 活跃外联数
        uint256 positiveRate;   // 正向回复率（bps, 1500 = 15%）
        uint256 snapshotAt;     // 快照时间
    }

    uint256 public snapshotCount;
    mapping(uint256 => TrendSnapshot) public snapshots;
    mapping(address => bool) public oracles;

    event SnapshotCreated(
        uint256 indexed snapshotId,
        bytes32 reportHash,
        uint256 totalEvents,
        uint256 positiveRate
    );

    modifier onlyOracle() {
        require(oracles[msg.sender], "Not authorized oracle");
        _;
    }

    constructor() {
        oracles[msg.sender] = true;
    }

    function setOracle(address account, bool authorized) external onlyOracle {
        oracles[account] = authorized;
    }

    function createSnapshot(
        bytes32 reportHash,
        string calldata reportURI,
        uint256 periodStart,
        uint256 periodEnd,
        uint256 totalEvents,
        uint256 activeOutreach,
        uint256 positiveRate
    ) external onlyOracle returns (uint256 snapshotId) {
        snapshotId = snapshotCount++;
        snapshots[snapshotId] = TrendSnapshot({
            reportHash: reportHash,
            reportURI: reportURI,
            periodStart: periodStart,
            periodEnd: periodEnd,
            totalEvents: totalEvents,
            activeOutreach: activeOutreach,
            positiveRate: positiveRate,
            snapshotAt: block.timestamp
        });

        emit SnapshotCreated(snapshotId, reportHash, totalEvents, positiveRate);
    }

    function getSnapshot(uint256 snapshotId) external view returns (TrendSnapshot memory) {
        require(snapshotId < snapshotCount, "Snapshot not found");
        return snapshots[snapshotId];
    }

    function latestSnapshot() external view returns (TrendSnapshot memory) {
        require(snapshotCount > 0, "No snapshots yet");
        return snapshots[snapshotCount - 1];
    }
}
