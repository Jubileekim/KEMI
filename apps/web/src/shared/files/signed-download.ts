// Keep the new tab creation in the original user gesture. Browsers can block
// window.open() when it happens after the signed download URL is fetched.
export interface DownloadPopup {
  opener: unknown;
  location: { replace: (url: string) => void };
  close: () => void;
}

export default async function openSignedDownload(
  resolveUrl: () => Promise<string>,
  openPopup: () => DownloadPopup | null,
  notify: (message: string) => void,
): Promise<void> {
  let popup: DownloadPopup | null;
  try {
    popup = openPopup();
  } catch {
    notify("새 창을 열지 못했어요. 브라우저 팝업 차단을 확인해 주세요.");
    return;
  }
  if (!popup) {
    notify("새 창을 열지 못했어요. 브라우저 팝업 차단을 확인해 주세요.");
    return;
  }

  try {
    // Prevent the downloaded document from gaining access to this app.
    popup.opener = null;
    const url = await resolveUrl();
    popup.location.replace(url);
  } catch {
    popup.close();
    notify("파일 주소를 가져오지 못했어요. 다시 시도해 주세요.");
  }
}
