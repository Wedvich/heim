interface GoogleIdConfiguration {
  client_id: string;
  ux_mode: "redirect" | "popup";
  login_uri?: string;
  callback?: (response: { credential: string; select_by: string }) => void;
  state?: string;
}

interface GsiButtonConfiguration {
  theme?: string;
  size?: string;
}

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfiguration) => void;
          renderButton: (element: HTMLElement, options: GsiButtonConfiguration) => void;
        };
      };
    };
  }
}

export {};
