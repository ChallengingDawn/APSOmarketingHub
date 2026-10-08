// The parts of ssh2-sftp-client and ssh2 the Compass file pull uses. Neither package
// ships types (and @types/* are not installed); both stay unbundled server packages
// (next.config.ts serverExternalPackages).

declare module "ssh2-sftp-client" {
  export type FileInfo = {
    /** "d" folder, "-" file, "l" link - the first letter of the SFTP long name. */
    type: string;
    name: string;
    size: number;
    /** ms since epoch (the SFTP mtime x 1000). */
    modifyTime: number;
    accessTime: number;
    longname: string;
  };
  export type ConnectOptions = {
    host: string;
    port?: number;
    username: string;
    privateKey?: string | Buffer;
    passphrase?: string;
    readyTimeout?: number;
    /** ssh2-sftp-client's own reconnect attempts (default 1, 25 s apart). */
    retries?: number;
    /** Called with the server's raw host key blob before authentication; false refuses. */
    hostVerifier?: (key: Buffer) => boolean;
  };
  export default class SftpClient {
    constructor(name?: string);
    connect(options: ConnectOptions): Promise<unknown>;
    list(remotePath: string): Promise<FileInfo[]>;
    get(remotePath: string, dst: NodeJS.WritableStream): Promise<unknown>;
    end(): Promise<boolean>;
  }
}

declare module "ssh2" {
  export const utils: {
    /** A parsed key (or several), or an Error when the text is no key ssh2 can read. */
    parseKey(data: string | Buffer, passphrase?: string): unknown;
  };
}
