import { readFileSync } from 'node:fs';

// 패키지 버전을 package.json에서 읽는다. 컴파일 뒤 위치(dist/src)에서 두 단계 위가 저장소 루트다. cli.ts의 readVersion과 같은 규칙이다.
export function readPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
  return pkg.version;
}
