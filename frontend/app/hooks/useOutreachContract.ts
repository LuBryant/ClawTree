'use client';

import { useCallback, useState } from 'react';
import { CONTRACTS } from '../config/tron';
import { OUTREACH_RECORD_ABI } from '../config/outreach-abi';

interface AnchorParams {
  outreachId: string;
  university: string;
  eventTitle: string;
  emailBodyHash: string;
}

interface AnchorResult {
  txHash: string;
  network: string;
  isMock: boolean;
}

/**
 * 与 OutreachRecord 合约交互的 hook。
 *
 * 前提条件：
 *   1. 合约已部署到 TRON Nile 测试网
 *   2. CONTRACTS.OutreachRecord 已填入部署地址
 *   3. 用户已安装 TronLink 并连接
 *
 * 用法：
 *   const { anchor, anchoring } = useOutreachContract();
 *   const result = await anchor({ outreachId, university, eventTitle, emailBodyHash });
 */
export function useOutreachContract() {
  const [anchoring, setAnchoring] = useState(false);

  const anchor = useCallback(async (params: AnchorParams): Promise<AnchorResult> => {
    setAnchoring(true);
    try {
      const contractAddr = CONTRACTS.OutreachRecord;

      // 合约地址为空 → 回退 mock
      if (!contractAddr) {
        return await mockAnchor(params);
      }

      // 检查 TronLink 是否可用
      const tw = window.tronWeb;
      if (!tw?.ready) {
        console.warn('TronLink 未连接，使用 mock 模式');
        return await mockAnchor(params);
      }

      // 通过 TronLink 调用合约
      const contract = await tw.contract(OUTREACH_RECORD_ABI as never, contractAddr);

      // bytes32 emailHash: 对邮件体做 keccak256
      const emailHash = tw.sha3(params.emailBodyHash);
      if (!emailHash) throw new Error('sha3 哈希失败');

      const result = await contract.recordOutreach(
        params.outreachId,
        params.university,
        params.eventTitle,
        emailHash,
      ).send({
        feeLimit: 100_000_000, // 100 TRX
        shouldPollResponse: true,
      });

      const txHash = result?.transaction?.txID || result;

      return {
        txHash: typeof txHash === 'string' ? txHash : JSON.stringify(txHash),
        network: 'TRON Nile',
        isMock: false,
      };
    } catch (err) {
      console.error('合约调用失败，回退 mock:', err);
      return await mockAnchor(params);
    } finally {
      setAnchoring(false);
    }
  }, []);

  return { anchor, anchoring };
}

/** 本地 mock 锚定（合约未部署或无 TronLink 时使用） */
async function mockAnchor(params: AnchorParams): Promise<AnchorResult> {
  // 确定性 hash 模拟链上行为
  const input = `${params.outreachId}:${params.university}:${params.eventTitle}:${params.emailBodyHash}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  const hashHex = '0x' + Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    txHash: hashHex,
    network: 'TRON Nile (mock)',
    isMock: true,
  };
}
