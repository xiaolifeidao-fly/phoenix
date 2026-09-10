"use client";

import { Button, Drawer, Space } from "antd";
import type { DrawerProps } from "antd";
import type { ReactNode } from "react";

interface WorkspaceDrawerProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  submitting?: boolean;
  /** 确认按钮单独置灰，用于表单数据还没准备好、但仍允许关闭抽屉的场景 */
  okDisabled?: boolean;
  okText?: string;
  cancelText?: string;
  width?: DrawerProps["width"];
  onClose: () => void;
  onSubmit?: () => void | Promise<void>;
}

export function WorkspaceDrawer({
  open,
  title,
  children,
  submitting = false,
  okDisabled = false,
  okText = "保存",
  cancelText = "取消",
  width = 560,
  onClose,
  onSubmit,
}: WorkspaceDrawerProps) {
  return (
    <Drawer
      className="manager-workspace-drawer"
      destroyOnHidden
      maskClosable={!submitting}
      open={open}
      title={title}
      width={width}
      onClose={onClose}
      footer={
        <div className="manager-drawer-footer">
          <Space>
            <Button onClick={onClose} disabled={submitting}>
              {cancelText}
            </Button>
            {onSubmit ? (
              <Button type="primary" loading={submitting} disabled={okDisabled} onClick={() => void onSubmit()}>
                {okText}
              </Button>
            ) : null}
          </Space>
        </div>
      }
    >
      <div className="manager-drawer-body">{children}</div>
    </Drawer>
  );
}
