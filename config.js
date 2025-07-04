// config.js (VERSI FINAL SEBENARNYA)

// ===================================================================================
// PENGATURAN OTOMATISASI
// ===================================================================================
export const AUTOMATION_CONFIG = {
    execution_order: ['deposit', 'swap'],

    min_delay_seconds: 10,
    max_delay_seconds: 25,
    slippage_percent: 3,

    deposit: {
        enabled: false,
        amount: 0.5
    },
    withdraw: { enabled: false, amount: 0.1 },

    swap: {
        enabled: true,
        tx_count: 1,
        pairs_and_amounts: [
            { from: 'WPHRS', to: 'WETH', amount: 0.2 }
        ]
    },
    
    addLP: { enabled: false }, // Matikan dulu sampai swap benar-benar berhasil
    
    run_in_loop: { enabled: false }
};

// ===================================================================================
// KONFIGURASI INTI
// ===================================================================================
export const RPC_URL = "https://testnet.dplabs-internal.com";
export const PHRS_CONTRACT_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const WPHRS_CONTRACT_ADDRESS = "0x3019B247381c850ab53Dc0EE53bCe7A07Ea9155f";
export const USDC_CONTRACT_ADDRESS = "0x72df0bcd7276f2dFbAc900D1CE63c272C4BCcCED";
export const WETH_CONTRACT_ADDRESS = "0x4E28826d32F1C398DED160DC16Ac6873357d048f";
export const POOL_ROUTER_ADDRESS = "0xf05Af5E9dC3b1dd3ad0C087BD80D7391283775e0";

export const tickers = {
    PHRS: PHRS_CONTRACT_ADDRESS,
    WPHRS: WPHRS_CONTRACT_ADDRESS,
    USDC: USDC_CONTRACT_ADDRESS,
    WETH: WETH_CONTRACT_ADDRESS,
};

export const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function deposit() payable",
    "function withdraw(uint256 wad)"
];

// ABI untuk Router KUSTOM - DIKEMBALIKAN SEPERTI SKRIP PYTHON ASLI
export const UNISWAP_V2_ABI = [
    "function getAmountsOut(uint256 amountIn, address[] memory path, uint256[] memory fees) view returns (uint256[] memory amounts)",
    "function addLiquidity(address tokenA, address tokenB, uint256 fee, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256, uint256, uint256)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)"
];
