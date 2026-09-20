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
      let panelVisible = false;
      let notice: NavigationNotice | undefined;
      const seenNotices = new Set<string>();
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
        const currentState = state;
        const panel =
          currentState && panelVisible ? (
            <ReminderPanel
              state={currentState}
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
                if (item)
                  void dispatch({ type: 'snooze', id: item.id }).catch(() => {
                    void ctx.isInvalid;
                  });
              }}
            />
          ) : null;
        const stackPanel = currentState?.settings.position === 'top-right';
        ui.mounted?.render(
          <>
            {(notice || (panel && stackPanel)) && (
              <div className="page-notifications position-top-right">
                {notice && (
                  <NavigationToast key={notice.id} notice={notice} onDismiss={dismissNotice} />
                )}
                {stackPanel && panel}
              </div>
            )}
            {!stackPanel && panel}
          </>,
        );
      };
      const receive = (message: {
        type: string;
        visible?: boolean;
        state?: State;
        notice?: NavigationNotice;
      }) => {
        if (ctx.isInvalid) return;
        if (message.type === 'navigation-notice' && message.notice) {
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
