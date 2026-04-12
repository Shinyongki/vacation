/**
 * SEA (Single Executable Application) 빌드 스크립트
 *
 * 단계:
 * 1. Vite로 클라이언트 빌드 (dist/)
 * 2. esbuild로 서버 번들링 (better-sqlite3 외부 모듈로 처리)
 * 3. Node.js SEA blob 생성
 * 4. .exe 생성
 *
 * 사전 요구사항:
 * - Node.js 20+ (SEA 지원)
 * - npm install -g esbuild (또는 npx esbuild)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const BUILD_DIR = path.join(ROOT, 'build');
const SERVER_BUNDLE = path.join(BUILD_DIR, 'server.cjs');
const SEA_CONFIG = path.join(BUILD_DIR, 'sea-config.json');
const SEA_BLOB = path.join(BUILD_DIR, 'sea-prep.blob');
const OUTPUT_EXE = path.join(BUILD_DIR, 'leave-management.exe');

function run(cmd, opts = {}) {
  console.log(`  > ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

function step(msg) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${msg}`);
  console.log('='.repeat(50));
}

// ============================================================
// 1. 클라이언트 빌드
// ============================================================
step('Step 1: Vite 클라이언트 빌드');
run('npx vite build');

if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.error('ERROR: Vite build failed — dist/index.html not found');
  process.exit(1);
}
console.log('  Client build OK');

// ============================================================
// 2. 빌드 디렉토리 준비
// ============================================================
step('Step 2: 빌드 디렉토리 준비');
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

// ============================================================
// 3. 서버 번들링 (esbuild)
// ============================================================
step('Step 3: esbuild 서버 번들링');

// better-sqlite3는 네이티브 모듈이므로 외부로 처리
// SEA에서는 네이티브 모듈을 함께 배포해야 함
try {
  run(`npx esbuild server/index.js --bundle --platform=node --target=node20 --outfile=${SERVER_BUNDLE} --external:better-sqlite3 --external:cpu-features --external:node-cron`);
  console.log('  Server bundle OK');
} catch (e) {
  console.error('WARNING: esbuild failed. Falling back to direct server execution.');
  // 폴백: server/index.js 직접 복사
  fs.copyFileSync(path.join(ROOT, 'server', 'index.js'), SERVER_BUNDLE);
}

// ============================================================
// 4. SEA 설정 생성
// ============================================================
step('Step 4: SEA 설정 파일 생성');

const seaConfig = {
  main: SERVER_BUNDLE,
  output: SEA_BLOB,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: true
};

fs.writeFileSync(SEA_CONFIG, JSON.stringify(seaConfig, null, 2));
console.log('  sea-config.json created');

// ============================================================
// 5. SEA Blob 생성
// ============================================================
step('Step 5: SEA Blob 생성');
try {
  run(`node --experimental-sea-config ${SEA_CONFIG}`);
  console.log('  SEA blob created');
} catch (e) {
  console.error('WARNING: SEA blob generation failed.');
  console.error('  Node.js 20+ required for SEA support.');
  console.error('  Alternatively, run with: node server/index.js');
  console.log('\n  빌드가 완료되었습니다 (SEA 제외).');
  console.log(`  실행: cd ${ROOT} && node server/index.js`);
  process.exit(0);
}

// ============================================================
// 6. .exe 생성
// ============================================================
step('Step 6: .exe 생성');
try {
  // Node.js 바이너리 복사
  const nodePath = process.execPath;
  fs.copyFileSync(nodePath, OUTPUT_EXE);

  // SEA blob 주입
  if (process.platform === 'win32') {
    // Windows: postject 사용
    run(`npx postject ${OUTPUT_EXE} NODE_SEA_BLOB ${SEA_BLOB} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`);
  } else {
    console.log('  Non-Windows platform: SEA injection skipped');
  }

  console.log(`\n  .exe 생성 완료: ${OUTPUT_EXE}`);
} catch (e) {
  console.error('WARNING: .exe generation failed:', e.message);
  console.log('\n  빌드가 완료되었습니다 (exe 제외).');
}

// ============================================================
// 7. 배포 패키지 생성
// ============================================================
step('Step 7: 배포 패키지 준비');

// better-sqlite3 네이티브 모듈 복사
const nativeModuleSrc = path.join(ROOT, 'node_modules', 'better-sqlite3');
const nativeModuleDest = path.join(BUILD_DIR, 'node_modules', 'better-sqlite3');
if (fs.existsSync(nativeModuleSrc)) {
  console.log('  Copying better-sqlite3 native module...');
  fs.cpSync(nativeModuleSrc, nativeModuleDest, { recursive: true });
}

// dist 폴더 복사 (클라이언트)
const distDest = path.join(BUILD_DIR, 'dist');
if (fs.existsSync(DIST_DIR)) {
  fs.cpSync(DIST_DIR, distDest, { recursive: true });
}

// DB 스키마/시드 복사
const dbDir = path.join(BUILD_DIR, 'server', 'database');
fs.mkdirSync(dbDir, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'server', 'database', 'schema.sql'), path.join(dbDir, 'schema.sql'));
fs.copyFileSync(path.join(ROOT, 'server', 'database', 'seed.sql'), path.join(dbDir, 'seed.sql'));

console.log('');
console.log('  ==========================================');
console.log('  빌드 완료!');
console.log('  ==========================================');
console.log(`  빌드 결과: ${BUILD_DIR}`);
console.log(`  실행 방법: node server/index.js`);
console.log('  또는 build/leave-management.exe (SEA)');
console.log('  ==========================================');
