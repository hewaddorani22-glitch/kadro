(function () {
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    for (var fallback = 0; fallback < items.length; fallback += 1) items[fallback].classList.add('in-view');
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    for (var index = 0; index < entries.length; index += 1) {
      if (!entries[index].isIntersecting) continue;
      entries[index].target.classList.add('in-view');
      observer.unobserve(entries[index].target);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
  for (var item = 0; item < items.length; item += 1) observer.observe(items[item]);
})();
