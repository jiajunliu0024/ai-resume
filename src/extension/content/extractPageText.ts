export type ExtractedPageText = {
  title: string;
  url: string;
  text: string;
};

export function extractPageText(): ExtractedPageText {
  return {
    title: document.title,
    url: window.location.href,
    text: document.body.innerText.trim(),
  };
}
