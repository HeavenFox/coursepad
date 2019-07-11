declare var require: {
  <T>(path: string): T;
  (paths: string[], callback: (...modules: any[]) => void): void;
  ensure: (
    paths: string[],
    callback: (require: <T>(path: string) => T) => void
  ) => void;
};

interface Window {
  ga?: any;
  twttr: any;
  FB: any;
  gapi: any;
  jQuery: any;
  fbAsyncInit(): void;
  React: any;
  ReactDOM: any;
}
