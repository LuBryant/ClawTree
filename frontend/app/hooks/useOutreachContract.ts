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

      // 记录当前 outreachCount，用于判断交易是否成功
      const countBefore = await contract.outreachCount().call();

      try {
        // send() 在 TronLink 中会弹出确认框；返回格式因版本而异
        const result: unknown = await contract.recordOutreach(
          params.outreachId,
          params.university,
          params.eventTitle,
          emailHash,
        ).send({ feeLimit: 100_000_000 });

        // 尝试多种路径提取 txID
        const txHash = extractTxHash(result);

        // 验证交易是否真的成功了
        const countAfter = await contract.outreachCount().call();
        const succeeded = countAfter.toString() !== countBefore.toString();

        if (txHash) {
          return {
            txHash,
            network: succeeded ? 'TRON Nile' : 'TRON Nile (reverted)',
            isMock: false,
            explorerUrl: `${EXPLORER_BASE}/#/transaction/${txHash}`,
          };
        }

        if (succeeded) {
          // 交易成功但没拿到 txID — 用 outreachId 生成确定性引用
          const fallbackHash = '0x' + tw.sha3(params.outreachId).replace(/^0x/, '');
          return {
            txHash: fallbackHash,
            network: 'TRON Nile (confirmed)',
            isMock: false,
            explorerUrl: `${EXPLORER_BASE}/#/contract/${contractAddr}`,
          };
        }

        throw new Error('交易未确认');
      } catch (sendErr: unknown) {
        // 检查是否尽管 catch 了但交易仍成功了
        try {
          const countAfter = await contract.outreachCount().call();
          if (countAfter.toString() !== countBefore.toString()) {
            const fallbackHash = '0x' + tw.sha3(params.outreachId).replace(/^0x/, '');
            return {
              txHash: fallbackHash,
              network: 'TRON Nile (confirmed)',
              isMock: false,
              explorerUrl: `${EXPLORER_BASE}/#/contract/${contractAddr}`,
            };
          }
        } catch { /* ignore */ }

        // 提取 txID
        const err = sendErr as Record<string, unknown> | undefined;
        const txHash = extractTxHash(err);
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

/** 从 send() 的返回值中尝试提取 txID（兼容各种 tronweb 版本） */
function extractTxHash(result: unknown): string {
  if (!result) return '';
  if (typeof result === 'string') return result;
  if (Array.isArray(result)) return '';
  const r = result as Record<string, unknown>;
  const tx = r?.transaction as Record<string, unknown> | undefined;
  return String(r?.txid || r?.txID || tx?.txID || r?.tx || '').replace('[]', '');
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
