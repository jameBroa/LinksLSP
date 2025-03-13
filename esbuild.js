const esbuild = require("esbuild");
const fs = require('fs');
const path = require('path');
// Directories to exclude from copying
const EXCLUDED_DIRS = ['.git', 'node_modules', '_build'];
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

function copyRecursive(src, dest) {
	if (!fs.existsSync(dest)) {
	  fs.mkdirSync(dest, { recursive: true });
	}
	
	const files = fs.readdirSync(src);
	
	for (const file of files) {
		if (EXCLUDED_DIRS.includes(file)) {
			console.log(`Skipping excluded directory: ${file}`);
			continue;
		  }
	  const srcPath = path.join(src, file);
	  const destPath = path.join(dest, file);
	  
	  const stats = fs.statSync(srcPath);
	  
	  if (stats.isDirectory()) {
		copyRecursive(srcPath, destPath);
	  } else {
		fs.copyFileSync(srcPath, destPath);
	  }
	}
}


/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			'client/src/extension.ts',
			'server/src/extension.ts'
		],
		bundle: true,
		outdir:'dist',
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
	const sourceDir = path.join(__dirname,  'LinksParser');
	const serverOutDir = path.join(__dirname, 'dist');
	copyRecursive(sourceDir, path.join(serverOutDir, 'parser-pipline'));
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
