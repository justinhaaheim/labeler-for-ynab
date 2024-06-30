export default function initiateUserJSONDownload(
  filename: string,
  jsonObject: unknown,
): void {
  const blob = new Blob([JSON.stringify(jsonObject)], {
    type: 'application/json',
  });
  const link = document.createElement('a');

  link.download = filename;
  const objectURL = window.URL.createObjectURL(blob);
  link.href = objectURL;

  // Is this needed?
  link.dataset['downloadurl'] = ['text/json', link.download, link.href].join(
    ':',
  );

  const evt = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  });

  link.dispatchEvent(evt);
  link.remove();
  URL.revokeObjectURL(objectURL);
}

// export default function initiateUserJSONDownload(
//   filename: string,
//   jsonObject: unknown,
// ): void {

//   var a = document.createElement('a');
//   a.href = URL.createObjectURL(
//     new Blob([jsonObject], {type: 'application/json'}),
//   );
//   a.download = 'myFile.json';
//   a.click();
// }
