// Scope hints only: these records never authorize execution or replace evidence review.
export function analyzePrompt(prompt) {
  const original = String(prompt ?? '').normalize('NFKC');
  const excluded = [];
  const clauses = original.split(/[，,；;。\n]+|(?:但是|但|而是|改为|同时|并且|然后)|并(?=(?:修改|实现|开发|新增|提供)?(?:前端|后端))/u)
    .map(part => {
      const negative = /(?:不要|不需要|无需|禁止|不允许|不使用|不用|不做|不开发|不涉及|不生成|不新建|不创建|不复刻)/u.exec(part);
      if (negative) { excluded.push(part.slice(negative.index).trim()); part = part.slice(0, negative.index); }
      const text = part.trim();
      const analysis = /(?:只|仅)(?:做|进行)?(?:分析|评估|审核|解释|讨论|给.*方案)|如何|怎么|怎样|是否|评估|功能分析|方案分析/u.test(text);
      return {text, mode: analysis ? 'analysis' : 'execute'};
    }).filter(part => part.text);
  // Only active constraints propagate; 'do not only analyze' must not suppress implementation.
  const analysisOnly = clauses.some(part=>/(?:只|仅)(?:做|进行)?(?:分析|评估|(?:安全|代码|性能)?审核|解释|讨论|给.*方案)/u.test(part.text));
  if (analysisOnly) clauses.forEach(part=>{part.mode='analysis';});
  const modes = new Set(clauses.map(part => part.mode));
  return {original, clauses, excluded, activeText:clauses.map(part=>part.text).join('，'),
    executionText:clauses.filter(part=>part.mode==='execute').map(part=>part.text).join('，'),
    intent:modes.size>1?'mixed':modes.has('execute')?'execute':'analysis'};
}
