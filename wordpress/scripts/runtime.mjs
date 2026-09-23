import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCLI } from '@wp-playground/cli';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function startWordPress({ port = 9400, storage = '.runtime', seed = true } = {}) {
  const root = resolve(projectRoot, storage);
  await mkdir(root, { recursive: true });
  const credentialPath = resolve(root, 'local-admin.json');
  let credentials;
  try { credentials = JSON.parse(await readFile(credentialPath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    credentials = { username: 'matinf-admin', password: randomBytes(24).toString('base64url') };
    await writeFile(credentialPath, JSON.stringify(credentials, null, 2), { mode: 0o600, flag: 'wx' });
  }
  const site = resolve(root, 'site');
  await mkdir(site, { recursive: true });
  const hasCore = await access(resolve(site, 'wp-load.php')).then(() => true, () => false);
  const server = await runCLI({
    command: 'server', port, php: '8.3', wp: '7.1.2', workers: 6, login: false,
    'define-bool': { DISABLE_WP_CRON: true, AUTOMATIC_UPDATER_DISABLED: true },
    wordpressInstallMode: hasCore ? 'install-from-existing-files-if-needed' : 'download-and-install',
    'mount-before-install': [{ hostPath: site, vfsPath: '/wordpress' }],
    mount: [
      { hostPath: resolve(projectRoot, 'plugins/matinf-core'), vfsPath: '/wordpress/wp-content/plugins/matinf-core' },
      { hostPath: resolve(projectRoot, 'themes/matinf'), vfsPath: '/wordpress/wp-content/themes/matinf' },
    ],
    blueprint: {
      preferredVersions: { php: '8.3', wp: '7.1.2' },
      features: { networking: true },
      steps: [
        { step: 'defineWpConfigConsts', consts: { WP_ENVIRONMENT_TYPE: 'local', DISALLOW_FILE_EDIT: true, DISABLE_WP_CRON: true, AUTOMATIC_UPDATER_DISABLED: true } },
        { step: 'activatePlugin', pluginPath: 'matinf-core/matinf-core.php' },
        { step: 'activateTheme', themeFolderName: 'matinf' },
        { step: 'runPHP', code: `<?php
          require '/wordpress/wp-load.php';
          $credentials = json_decode(base64_decode('${Buffer.from(JSON.stringify(credentials)).toString('base64')}'), true);
          if (!username_exists($credentials['username'])) {
            $id = wp_create_user($credentials['username'], $credentials['password'], 'admin@example.invalid');
            if (is_wp_error($id)) throw new RuntimeException($id->get_error_message());
            (new WP_User($id))->set_role('administrator');
          }
          // Disable the Playground bootstrap account's known default password.
          $default = get_user_by('login', 'admin');
          if ($default) { wp_set_password(wp_generate_password(64, true, true), $default->ID); $default->set_role('subscriber'); }
          if (!get_option('matinf_local_initialized')) {
            update_option('blogname', 'MATINF');
            update_option('blogdescription', 'Matematika. Informatika. Budućnost.');
            update_option('blog_public', 0);
            update_option('timezone_string', 'Europe/Belgrade');
            update_option('permalink_structure', '/%postname%/');
            update_option('matinf_local_initialized', true);
          }
          ${seed ? 'matinf_seed_demo();' : ''}
          flush_rewrite_rules();
        ` },
      ],
    },
  });
  // CLI currently binds all interfaces. Limit this development server to this
  // PC; Android reaches it using adb reverse, not a public/LAN admin server.
  await new Promise((resolveClose, reject) => server.server.close(error => error ? reject(error) : resolveClose()));
  await new Promise((resolveListen, reject) => {
    server.server.once('error', reject);
    server.server.listen(port, '127.0.0.1', resolveListen);
  });
  return Object.assign(server, { credentials, root });
}
