'use client';

import { useCallback, useState } from 'react';
import { CONTRACTS, EXPLORER_BASE } from '../config/tron';
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
  explorerUrl: string;
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

      if (!contractAddr) {
        return mockAnchor(params);
      }

      const tw = window.tronWeb;
      if (!tw?.ready) {
        console.warn('TronLink 未连接，使用 mock 模式');
        return mockAnchor(params);
      }

      const contract = await tw.contract(OUTREACH_RECORD_ABI as never, contractAddr);
      const userAddr = tw.defaultAddress.base58;

      // 先授权当前钱包为 recorder（若尚未授权）
      try {
        const isRecorder = await contract.recorders(userAddr).call();
        if (!isRecorder) {
          await contract.setRecorder(userAddr, true).send({
            feeLimit: 50_000_000,
            shouldPollResponse: true,
          });
        }
      } catch {
        // setRecorder 失败不阻断，可能已经是 recorder 或无权限
        console.warn('setRecorder 跳过（可能已授权或权限不足）');
      }

      // bytes32 emailHash: TRON keccak256
      const emailHash = tw.sha3(params.emailBodyHash);
      if (!emailHash) throw new Error('sha3 哈希失败');

      let txHash = '';

      try {
        const result = await contract.recordOutreach(
          params.outreachId,
          params.university,
          params.eventTitle,
          emailHash,
        ).send({
          feeLimit: 100_000_000,
          shouldPollResponse: true,
        });

        txHash = result?.transaction?.txID || result?.txid || result;
        if (typeof txHash !== 'string') txHash = JSON.stringify(txHash);

        return {
          txHash,
          network: 'TRON Nile',
          isMock: false,
          explorerUrl: `${EXPLORER_BASE}/#/transaction/${txHash}`,
        };
      } catch (sendErr: unknown) {
        // REVERT 或其它链上错误 — 尝试提取 txID
        const err = sendErr as Record<string, unknown> | undefined;
        txHash = (err?.transaction?.txID
          || err?.txid
          || err?.txID
          || '') as string;

        if (txHash) {
          return {
            txHash,
            network: 'TRON Nile (reverted)',
            isMock: false,
            explorerUrl: `${EXPLORER_BASE}/#/transaction/${txHash}`,
          };
        }

        console.error('合约调用失败，回退 mock:', sendErr);
        return mockAnchor(params);
      }
    } catch (err) {
      console.error('合约调用失败，回退 mock:', err);
      return mockAnchor(params);
    } finally {
      setAnchoring(false);
    }
  }, []);

  return { anchor, anchoring };
}

/** 本地 mock 锚定（合约未部署或无 TronLink 时使用） */
async function mockAnchor(params: AnchorParams): Promise<AnchorResult> {
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
    explorerUrl: '',
  };
}
