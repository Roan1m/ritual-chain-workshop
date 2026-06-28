import { http, createConfig } from "wagmi";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";

const env = import.meta.env;

/** roan's AIJudge, deployed from the Roan1m wallet. */
export const CONTRACT = (env.VITE_CONTRACT_ADDRESS ??
  "0xc6cbA50A1021820E988f59A6F30f133e8ec6bb6b") as `0x${string}`;

export const EXECUTOR = (env.VITE_EXECUTOR ??
  "0xB42e435c4252A5a2E7440e37B609F00c61a0c91B") as `0x${string}`;

const RPC = (env.VITE_RPC as string) ?? "https://rpc.ritualfoundation.org";
export const CHAIN_ID = Number(env.VITE_CHAIN_ID ?? 1979);
export const EXPLORER = "https://explorer.ritualfoundation.org";

export const ritual = defineChain({
  id: CHAIN_ID,
  name: "Ritual Chain",
  nativeCurrency: { name: "Ritual", symbol: "RITUAL", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "RitualScan", url: EXPLORER } },
});

export const wagmiConfig = createConfig({
  chains: [ritual],
  connectors: [injected({ shimDisconnect: true })],
  transports: { [ritual.id]: http(RPC) },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
