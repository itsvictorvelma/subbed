// The bar on every page: the wordmark, the search box, Home, Your songs, Sign in or the username,
// and the theme button. On a phone the links become icons and the search box opens from an icon.
import { useEffect, useState } from "react";
import { useAccount } from "../account/account";
import { BookmarkIcon, SearchIcon, UserIcon } from "../icons";
import { ACCOUNT_PATH, followLink, HOME_PATH, LIBRARY_PATH } from "../routing";
import type { Route } from "../routing";
import { focusSearchBox, SearchForm } from "../search/SearchForm";
import { ThemeButton } from "./ThemeButton";

interface HeaderProps {
  busy: boolean;
  onSearch: (query: string) => void;
  // False on the home page, which has its own large search box.
  showSearch: boolean;
  // Which page is shown, so its link is marked as the current page.
  currentPage: Route["page"];
}

export function Header({
  busy,
  onSearch,
  showSearch,
  currentPage,
}: HeaderProps) {
  const { username, checked } = useAccount();
  // Phone only: the header search box shows once its icon is pressed.
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (searchOpen) {
      focusSearchBox();
    }
  }, [searchOpen]);

  return (
    <header className={searchOpen ? "site-header is-searching" : "site-header"}>
      <a href={HOME_PATH} className="wordmark" onClick={followLink(HOME_PATH)}>
        subbed{" "}
        <span lang="ja" className="wordmark-kana">
          字幕
        </span>
      </a>
      {showSearch && <SearchForm busy={busy} onSearch={onSearch} />}
      <nav className="site-nav" aria-label="Main">
        {showSearch && (
          <button
            type="button"
            className="icon-button phone-only search-toggle"
            aria-label="Search"
            aria-expanded={searchOpen}
            onClick={() => {
              setSearchOpen((open) => !open);
            }}
          >
            <SearchIcon />
          </button>
        )}
        <a
          href={HOME_PATH}
          className="nav-link nav-home"
          aria-current={currentPage === "home" ? "page" : undefined}
          onClick={followLink(HOME_PATH)}
        >
          Home
        </a>
        <a
          href={LIBRARY_PATH}
          className="nav-link"
          aria-current={currentPage === "library" ? "page" : undefined}
          onClick={followLink(LIBRARY_PATH)}
        >
          <span className="phone-only nav-icon">
            <BookmarkIcon filled={false} />
          </span>
          <span className="nav-label">Your songs</span>
        </a>
        {checked && (
          <a
            href={ACCOUNT_PATH}
            className="nav-link"
            aria-current={currentPage === "account" ? "page" : undefined}
            onClick={followLink(ACCOUNT_PATH)}
          >
            <span className="phone-only nav-icon">
              <UserIcon />
            </span>
            <span className="nav-label">{username ?? "Sign in"}</span>
          </a>
        )}
        <ThemeButton />
      </nav>
    </header>
  );
}
