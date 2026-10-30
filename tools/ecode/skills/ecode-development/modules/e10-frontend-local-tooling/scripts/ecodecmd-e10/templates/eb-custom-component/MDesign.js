import React from 'react';
import { getLabel } from '@weapp/utils';

const MDesign = (props) => {
  const { config } = props;
  return <div className="cusStyleCls">{config.content}</div>;
};

// type 是平台保留属性，自定义组件 props 禁止使用。
MDesign.defaultProps = {
  config: { content: getLabel('187481', '示例组件') },
};

MDesign.flow = {
  defaultProps: {
    config: { content: getLabel('187481', '示例组件') },
  },
};

MDesign.defaultOpts = {
  operationBtns: true,
  mask: true,
  layoutSizes: {
    mgl: { w: 4, h: 150, adaptive: true },
  },
};

export default MDesign;
