const views = {
  homepage: {
    src: 'assets/homepage.png',
    alt: "Routinely's Today dashboard with a weekly calendar, two pending routines, and completed check-ins.",
    caption: 'A little structure. A clear view of your day.',
    label: 'Open full-size dashboard screenshot',
    width: 2560,
    height: 1600,
  },
  floating: {
    src: 'assets/floating-window.png',
    alt: 'A Routinely floating reminder on a reading page, with a note field, snooze, skip, and Mark done controls.',
    caption: 'A gentle reminder, right where you need it.',
    label: 'Open full-size floating reminder screenshot',
    width: 2560,
    height: 1600,
  },
  popover: {
    src: 'assets/extension-popover.png',
    alt: "The Routinely toolbar popup, with View later shortcuts and today's check-ins.",
    caption: 'Your routines and saved pages, one click away.',
    label: 'Open full-size extension popover screenshot',
    width: 840,
    height: 1180,
  },
};

const tablist = document.querySelector('.screenshot-tabs');
const tabs = [...tablist.querySelectorAll('[role="tab"]')];
const image = document.getElementById('product-image');
const stage = document.getElementById('product-preview');
const link = document.getElementById('screenshot-link');
const caption = document.getElementById('screenshot-caption');

function selectTab(tab) {
  const view = views[tab.dataset.view];
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
  }
  stage.dataset.view = tab.dataset.view;
  stage.setAttribute('aria-labelledby', tab.id);
  image.src = view.src;
  image.alt = view.alt;
  image.width = view.width;
  image.height = view.height;
  link.href = view.src;
  link.setAttribute('aria-label', view.label);
  caption.textContent = view.caption;
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectTab(tabs[next]);
    tabs[next].focus();
  });
}
tablist.hidden = false;
