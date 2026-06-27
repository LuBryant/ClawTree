// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title EventRegistry — 高校活动链上注册与存证
/// @notice 大树财经/ClawTree 将已验证的高校 AI/Web3 活动锚定上链，
///         形成不可篡改的活动目录，供前端 Dashboard 查询与趋势分析。
contract EventRegistry {
    struct Event {
        string  eventId;        // 活动唯一标识（如 "PKU-AI-2026-07"）
        string  university;     // 高校名称
        string  title;          // 活动标题
        string  category;       // AI / Web3 / Hackathon / Workshop / Lecture
        uint256 eventDate;      // 活动日期（Unix timestamp）
        string  location;       // 线上/线下/混合 及具体地点
        string  metadataURI;    // IPFS/Arweave 元数据链接
        address registeredBy;   // 注册者（ClawTree Agent 或管理员）
        uint256 registeredAt;   // 上链时间
        bool    exists;
    }

    uint256 public eventCount;
    mapping(string => Event) public events;       // eventId → Event
    mapping(uint256 => string) public eventIds;   // index → eventId
    mapping(address => bool) public registrars;   // 授权注册者

    event EventRegistered(
        string indexed eventId,
        string university,
        string title,
        uint256 eventDate,
        address indexed registeredBy
    );

    event RegistrarUpdated(address indexed account, bool authorized);

    modifier onlyRegistrar() {
        require(registrars[msg.sender], "Not authorized registrar");
        _;
    }

    constructor() {
        registrars[msg.sender] = true;
    }

    function setRegistrar(address account, bool authorized) external onlyRegistrar {
        registrars[account] = authorized;
        emit RegistrarUpdated(account, authorized);
    }

    function registerEvent(
        string calldata eventId,
        string calldata university,
        string calldata title,
        string calldata category,
        uint256 eventDate,
        string calldata location,
        string calldata metadataURI
    ) external onlyRegistrar {
        require(!events[eventId].exists, "Event already registered");
        require(bytes(eventId).length > 0, "Empty eventId");

        events[eventId] = Event({
            eventId: eventId,
            university: university,
            title: title,
            category: category,
            eventDate: eventDate,
            location: location,
            metadataURI: metadataURI,
            registeredBy: msg.sender,
            registeredAt: block.timestamp,
            exists: true
        });
        eventIds[eventCount] = eventId;
        eventCount++;

        emit EventRegistered(eventId, university, title, eventDate, msg.sender);
    }

    function getEvent(string calldata eventId) external view returns (Event memory) {
        require(events[eventId].exists, "Event not found");
        return events[eventId];
    }

    function getEventAtIndex(uint256 index) external view returns (Event memory) {
        require(index < eventCount, "Index out of bounds");
        return events[eventIds[index]];
    }
}
