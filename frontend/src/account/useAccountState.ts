// Who is signed in: asked once when the page opens (a failed check counts as a guest), then
// changed by signing in and out.
import { useCallback, useEffect, useState } from "react";
import { getAccount } from "../api";
import type { Account } from "../types";
import { UNKNOWN_ACCOUNT } from "./account";

export function useAccountState(
  // Told every time the signed-in state is known or changes.
  onSignedInChange: (signedIn: boolean) => void,
  // Told when the first check finds someone signed in, so their songs can load.
  onFoundSignedIn: () => void,
) {
  const [account, setAccount] = useState<Account>(UNKNOWN_ACCOUNT);

  const setUsername = useCallback(
    (username: string | null) => {
      onSignedInChange(username !== null);
      setAccount({ username, checked: true });
    },
    [onSignedInChange],
  );

  useEffect(() => {
    let active = true;
    void getAccount().then((result) => {
      if (!active) {
        return;
      }
      const username = result.kind === "ok" ? result.value : null;
      setUsername(username);
      if (username !== null) {
        onFoundSignedIn();
      }
    });
    return () => {
      active = false;
    };
  }, [setUsername, onFoundSignedIn]);

  return [account, setUsername] as const;
}
