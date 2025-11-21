import { useLocation } from "@solidjs/router";

/**
 * Navigation component that displays a list of links and highlights the active link based on the current route.
 * @returns {JSX.Element} The rendered navigation bar.
 */
export default function Nav() {
  const location = useLocation();
  const active = (path: string) =>
    path === location.pathname
      ? "border-sky-600"
      : "border-transparent hover:border-sky-600";
  return (
    <nav class="bg-sky-800">
      <ul class="container flex items-center p-3 text-gray-200">
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
      </ul>
    </nav>
  );
}
