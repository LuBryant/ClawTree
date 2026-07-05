const { expect } = require('chai');
const hre = require('hardhat');

async function expectRevert(promise, reason) {
  try {
    await promise;
  } catch (error) {
    expect(error.message).to.include(reason);
    return;
  }

  throw new Error(`Expected transaction to revert with "${reason}"`);
}

describe('ClawTree Contracts', function () {
  let owner, addr1;

  before(async () => {
    [owner, addr1] = await hre.ethers.getSigners();
  });

  // ---- EventRegistry ----
  describe('EventRegistry', function () {
    let registry;

    beforeEach(async () => {
      const Factory = await hre.ethers.getContractFactory('EventRegistry');
      registry = await Factory.deploy();
      await registry.waitForDeployment();
    });

    it('registers an event and retrieves it', async () => {
      const future = Math.floor(Date.now() / 1000) + 86400 * 30;
      await registry.registerEvent('PKU-AI-001', '北京大学', 'AI Hackathon', 'Hackathon', future, '北京/线上混合', 'ipfs://Qm...');

      const ev = await registry['getEvent(string)']('PKU-AI-001');
      expect(ev.university).to.equal('北京大学');
      expect(ev.category).to.equal('Hackathon');
      expect(ev.exists).to.be.true;
    });

    it('rejects duplicate eventId', async () => {
      const future = Math.floor(Date.now() / 1000) + 86400 * 30;
      await registry.registerEvent('THU-001', '清华大学', 'Web3 Workshop', 'Workshop', future, '线上', 'ipfs://Qm...');
      await expectRevert(
        registry.registerEvent('THU-001', '清华大学', 'Web3 Workshop 2', 'Workshop', future, '线上', 'ipfs://Qm...')
      , 'Event already registered');
    });

    it('rejects non-registrar', async () => {
      const future = Math.floor(Date.now() / 1000) + 86400 * 30;
      await expectRevert(
        registry.connect(addr1).registerEvent('FDU-001', '复旦大学', 'AI Summit', 'AI', future, '上海', 'ipfs://Qm...')
      , 'Not authorized registrar');
    });

    it('tracks event count and index', async () => {
      const future = Math.floor(Date.now() / 1000) + 86400 * 30;
      await registry.registerEvent('A-001', 'A大学', 'Event A', 'AI', future, '线上', 'ipfs://a');
      await registry.registerEvent('B-001', 'B大学', 'Event B', 'Web3', future, '线上', 'ipfs://b');

      expect(await registry.eventCount()).to.equal(2n);
      const e0 = await registry.getEventAtIndex(0);
      expect(e0.eventId).to.equal('A-001');
      const e1 = await registry.getEventAtIndex(1);
      expect(e1.eventId).to.equal('B-001');
    });
  });

  // ---- OutreachRecord ----
  describe('OutreachRecord', function () {
    let record;

    beforeEach(async () => {
      const Factory = await hre.ethers.getContractFactory('OutreachRecord');
      record = await Factory.deploy();
      await record.waitForDeployment();
    });

    it('records an outreach and reply', async () => {
      const emailHash = hre.ethers.id('email-content');
      await record.recordOutreach('OUT-001', '北京大学', 'PKU-AI-001', emailHash);

      const o = await record.getOutreach('OUT-001');
      expect(o.university).to.equal('北京大学');
      expect(o.emailHash).to.equal(emailHash);
      expect(o.replyIntent).to.equal(0n);

      const replyHash = hre.ethers.id('reply-content');
      await record.recordReply('OUT-001', replyHash, 1);

      const o2 = await record.getOutreach('OUT-001');
      expect(o2.replyHash).to.equal(replyHash);
      expect(o2.replyIntent).to.equal(1n);
    });
  });

  // ---- TrendOracle ----
  describe('TrendOracle', function () {
    let oracle;

    beforeEach(async () => {
      const Factory = await hre.ethers.getContractFactory('TrendOracle');
      oracle = await Factory.deploy();
      await oracle.waitForDeployment();
    });

    it('creates and retrieves snapshots', async () => {
      const hash = hre.ethers.id('trend-report-2026-07');
      const now = Math.floor(Date.now() / 1000);
      await oracle.createSnapshot(hash, 'ipfs://report', now - 86400 * 7, now, 50, 30, 1500);

      const snap = await oracle.latestSnapshot();
      expect(snap.reportHash).to.equal(hash);
      expect(snap.totalEvents).to.equal(50n);
      expect(snap.positiveRate).to.equal(1500n); // 15%
    });
  });
});
