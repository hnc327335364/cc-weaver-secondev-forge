import React from 'react';
import { getLabel } from '@weapp/utils';

const Design = (props) => {
  const { config } = props;
  return <div className="cusStyleCls">{config.content}</div>;
};

// type 是平台保留属性，自定义组件 props 禁止使用。
Design.defaultProps = {
  config: { content: getLabel('187481', '示例组件') },
};

Design.flow = {
  defaultProps: {
    config: { content: getLabel('187481', '示例组件') },
  },
};

Design.defaultOpts = {
  operationBtns: true,
  mask: false,
  layoutSizes: {
    gl: { w: 4, h: 15 },
    mgl: { adaptive: true, h: 150 },
  },
};

export default Design;
