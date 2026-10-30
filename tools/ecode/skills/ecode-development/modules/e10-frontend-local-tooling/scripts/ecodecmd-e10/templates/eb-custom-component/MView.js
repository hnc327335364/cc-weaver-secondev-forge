import React from 'react';

const MView = (props) => {
  const { config } = props;
  return <div className="cusStyleCls">{config.content}</div>;
};

export default MView;
