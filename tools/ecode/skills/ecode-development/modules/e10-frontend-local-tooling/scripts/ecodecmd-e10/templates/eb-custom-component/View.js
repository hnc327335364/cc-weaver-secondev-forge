import React from 'react';

const View = (props) => {
  const { config } = props;
  return <div className="cusStyleCls">{config.content}</div>;
};

export default View;
