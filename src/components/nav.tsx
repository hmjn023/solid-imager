import { useLocation } from "@solidjs/router";
import { createSignal, onCleanup, onMount } from "solid-js";
import { isServer } from "solid-js/web";

/**
 * Navigation component that displays a list of links and highlights the active link based on the current route.
 * Implements a "scroll-aware" behavior where the header hides on scroll down and reappears on scroll up.
 * @returns {JSX.Element} The rendered navigation bar.
 */
export default function Nav() {
  const location = useLocation();
  const active = (path: string) =>
    path === location.pathname
      ? "border-sky-600"
      : "border-transparent hover:border-sky-600";

  const [isVisible, setIsVisible] = createSignal(true);
  const [lastScrollY, setLastScrollY] = createSignal(0);

  const handleScroll = () => {
    if (isServer) {
      return;
    }
    const currentScrollY = window.scrollY;

    // Ignore negative scroll values (e.g., iOS bounce)
    if (currentScrollY < 0) {
      return;
    }

    const HideThreshold = 50;

    // Show header if at the top, or scrolling up
    // Hide header if scrolling down and past a threshold
    if (currentScrollY < lastScrollY() || currentScrollY < 10) {
      setIsVisible(true);
    } else if (
      currentScrollY > lastScrollY() &&
      currentScrollY > HideThreshold
    ) {
      setIsVisible(false);
    }

    setLastScrollY(currentScrollY);
  };

  onMount(() => {
    if (isServer) {
      return;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
  });

  onCleanup(() => {
    if (isServer) {
      return;
    }
    window.removeEventListener("scroll", handleScroll);
  });

  return (
    <>
      <nav
        class={`fixed top-0 right-0 left-0 z-50 w-full bg-sky-800 transition-transform duration-300 ${
          isVisible() ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div class="container relative flex items-center p-3">
          <ul class="flex items-center text-gray-200">
            <li class={`border-b-2 ${active("/")} mx-1.5 sm:mx-6`}>
              <a href="/">Home</a>
            </li>
            <li class={`border-b-2 ${active("/about")} mx-1.5 sm:mx-6`}>
              <a href="/about">About</a>
            </li>
            <li class={`border-b-2 ${active("/sources")} mx-1.5 sm:mx-6`}>
              <a href="/sources">Sources</a>
            </li>
            <li class={`border-b-2 ${active("/search")} mx-1.5 sm:mx-6`}>
              <a href="/search">Search</a>
            </li>
            <li class={`border-b-2 ${active("/manager")} mx-1.5 sm:mx-6`}>
              <a href="/manager">Manager</a>
            </li>
            <li class={`border-b-2 ${active("/docs")} mx-1.5 sm:mx-6`}>
              <a
                href="/docs/index.html"
                rel="noopener noreferrer"
                target="_blank"
              >
                Docs
              </a>
            </li>
          </ul>
          <div class="ml-auto flex items-center gap-2" id="nav-actions" />
        </div>
      </nav>
      {/* Spacer to prevent content from hiding behind the fixed header */}
      <div class="h-[52px]" />
    </>
  );
}
