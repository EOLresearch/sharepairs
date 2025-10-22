export function translate(template, vars = {}) {
  return template.replace(/{{(.*?)}}/g, (_, key) => vars[key.trim()] || '');
}
