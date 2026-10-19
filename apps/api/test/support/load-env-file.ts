// .env 형식 파일을 읽는다. 파일이 없으면 아무것도 하지 않는다. (이미 있는 환경 변수는 덮어쓰지 않는다)
export default function loadEnvFileIfExists(path: string): void {
  try {
    process.loadEnvFile(path);
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      return;
    }
    throw err;
  }
}
