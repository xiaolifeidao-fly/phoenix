"use client";

import type { ReactNode } from "react";
import { Tooltip } from "antd";
import { money } from "../../workbench/components/shared";

/** 带正负号的金额：+2,000 / -300 */
export function signed(value: number) {
  return `${value > 0 ? "+" : ""}${money(value)}`;
}

interface PairCellProps {
  manual: number | null;
  system: number | null;
  /** 带正负号显示（增量 / 利润） */
  delta?: boolean;
  /** 人工那行金额后面的补充，比如 U 原币 */
  manualExtra?: ReactNode;
  manualTip?: ReactNode;
  systemTip?: ReactNode;
}

/** 一个指标两行：上面人工、下面系统；两行都有值且对不上时整格标红 */
export function PairCell({ manual, system, delta, manualExtra, manualTip, systemTip }: PairCellProps) {
  const differs = manual !== null && system !== null && Math.abs(manual - system) > 0.01;
  const line = (kind: "manual" | "system", value: number | null, tip?: ReactNode, extra?: ReactNode) => {
    const content = (
      <div className={`recon-pair-line recon-pair-line--${kind}`}>
        <span className="recon-pair-tag">{kind === "manual" ? "人工" : "系统"}</span>
        {value === null ? (
          <span className="recon-pair-value recon-pair-value--empty">—</span>
        ) : (
          <span className="recon-pair-value">
            {delta ? signed(value) : money(value)}
            {extra}
          </span>
        )}
      </div>
    );
    return tip ? <Tooltip title={tip}>{content}</Tooltip> : content;
  };
  return (
    <div className={differs ? "recon-pair recon-pair--diff" : "recon-pair"}>
      {line("manual", manual, manualTip, manualExtra)}
      {line("system", system, systemTip)}
    </div>
  );
}
