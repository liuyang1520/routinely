import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { ReminderPanel } from '../components/ReminderPanel';
import { NavigationToast } from '../components/NavigationToast';
import type { NavigationNotice } from '../lib/navigation-notice';
import { dispatch } from '../lib/client';
import { dueItems } from '../lib/schedule';
import type { State } from '../lib/model';
import { isTheme, readExtensionTheme, resolvedTheme, THEME_KEY, type Theme } from '../lib/theme';
import '../assets/panel.css';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    try {
      const ui = await createShadowRootUi(ctx, {
        name: 'routinely-reminder',
        position: 'inline',
        anchor: 'body',
        isolateEvents: true,
        onMount(container) {
          const wrapper = document.createElement('div');
          container.append(wrapper);
          return createRoot(wrapper);
        },
        onRemove(root) {
          root?.unmount();
        },
      });
      if (ctx.isInvalid) return;
      ui.mount();
      let state: State | undefined;
      let theme: Theme = 'system';
      let panelVisible = false;
      let notice: NavigationNotice | undefined;
      const seenNotices = new Set<string>();
      const dismissedReminders = new Set<string>();
      const dismissNotice = () => {
        notice = undefined;
        render();
      };
      const render = () => {
        if (ctx.isInvalid) return;
        if (document.visibilityState !== 'visible') {
          ui.mounted?.render(null);
          return;
        }
        if (notice && notice.expiresAt <= Date.now()) notice = undefined;
        const currentState = state && {
          ...state,
          occurrences: state.occurrences.filter((item) => !dismissedReminders.has(item.id)),
        };
        const panel =
          currentState && panelVisible && dueItems(currentState).length > 0 ? (
            <ReminderPanel
              state={currentState}
              colorMode={resolvedTheme(theme)}
              act={async (action) => {
                try {
                  if (ctx.isInvalid) return false;
                  await dispatch(action);
                  return true;
                } catch {
                  // Checking validity also retires the UI if reload raced the send.
                  void ctx.isInvalid;
                  return false;
                }
              }}
              onClose={(id) => {
                if (ctx.isInvalid) return;
                const item = dueItems(currentState).find((o) => o.id === id);
                if (item) dismissedReminders.add(item.id);
                render();
              }}
            />
          ) : null;
        const activeNotice = !panel && notice?.kind !== 'routine' ? notice : undefined;
        const stackPanel = currentState?.settings.position === 'top-right';
        ui.mounted?.render(
          <>
            {(activeNotice || (panel && stackPanel)) && (
              <div className="page-notifications position-top-right">
                {activeNotice && (
                  <NavigationToast
                    key={activeNotice.id}
                    notice={activeNotice}
                    onDismiss={dismissNotice}
                  />
                )}
                {stackPanel && panel}
              </div>
            )}
            {!stackPanel && panel}
          </>,
        );
      };
      let receivedThemeChange = false;
      const onThemeChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
        const value = changes[THEME_KEY]?.newValue;
        if (area !== 'local' || !isTheme(value)) return;
        receivedThemeChange = true;
        theme = value;
        render();
      };
      browser.storage.onChanged.addListener(onThemeChange);
      ctx.onInvalidated(() => {
        try {
          if (browser.runtime.id) browser.storage.onChanged.removeListener(onThemeChange);
        } catch {
          // The extension may have been reloaded already.
        }
      });
      void readExtensionTheme().then((stored) => {
        if (ctx.isInvalid || receivedThemeChange || !stored) return;
        theme = stored;
        render();
      });
      const deviceTheme = window.matchMedia?.('(prefers-color-scheme: dark)');
      if (deviceTheme) {
        ctx.addEventListener(deviceTheme, 'change', () => {
          if (theme === 'system') render();
        });
      }
      const receive = (message: {
        type: string;
        visible?: boolean;
        state?: State;
        notice?: NavigationNotice;
      }) => {
        if (ctx.isInvalid) return;
        if (message.type === 'navigation-notice' && message.notice) {
          if (message.notice.kind === 'routine') return Promise.resolve({ shown: false });
          if (document.visibilityState !== 'visible') return Promise.resolve({ shown: false });
          if (!seenNotices.has(message.notice.id) && message.notice.expiresAt > Date.now()) {
            seenNotices.add(message.notice.id);
            if (seenNotices.size > 100) seenNotices.delete(seenNotices.values().next().value!);
            notice = message.notice;
            render();
          }
          return Promise.resolve({ shown: true });
        }
        if (message.type === 'panel-state' && message.state) {
          state = message.state;
          panelVisible = !!message.visible;
          render();
        }
      };
      ctx.onInvalidated(() => {
        // Chrome can throw synchronously even from removeListener after reload.
        // WXT also removes the shadow UI and its DOM event listeners on abort.
        try {
          if (browser.runtime.id) browser.runtime.onMessage.removeListener(receive);
        } catch {
          // The old runtime has already gone away; no listener remains to remove.
        }
      });
      try {
        browser.runtime.onMessage.addListener(receive);
      } catch (error) {
        if (ctx.isInvalid) return;
        throw error;
      }
      const sync = async () => {
        if (ctx.isInvalid) return;
        if (document.visibilityState !== 'visible') {
          ui.mounted?.render(null);
          return;
        }
        try {
          // try/await catches both synchronous throws and rejected promises.
          await browser.runtime.sendMessage({ type: 'panel-ready' });
        } catch {
          void ctx.isInvalid;
        }
      };
      ctx.addEventListener(document, 'visibilitychange', sync);
      ctx.addEventListener(window, 'focus', sync);
      void sync();
    } catch (error) {
      // A reload can also race the initial asynchronous stylesheet load.
      if (ctx.isValid) throw error;
    }
  },
});
