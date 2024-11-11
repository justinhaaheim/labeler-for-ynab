import nullthrows from 'nullthrows';

export function htmlEntityDecode(input: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');

  const decodedString = nullthrows(doc.body.textContent);
  return decodedString;
}
