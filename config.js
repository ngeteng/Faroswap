// config.js (VERSI FINAL)

// ===================================================================================
// PENGATURAN OTOMATISASI (UBAH DI SINI)
// ===================================================================================
export const AUTOMATION_CONFIG = {
    execution_order: ['deposit', 'swap', 'addLP'],

    min_delay_seconds: 10,
    max_delay_seconds: 25,
    
    // Toleransi selip harga saat swap, dalam persen. 1 = 1%.
    slippage_percent: 1,

    deposit: {
        enabled: false,
        amount: 0.5
    },

    withdraw: {
        enabled: false,
        amount: 0.1
    },

    swap: {
        enabled: true,
        tx_count: 1, // Kita coba 1 swap dulu yang paling mungkin berhasil
        pairs_and_amounts: [
            // Coba swap WPHRS ke WETH via Router Uniswap V2
            { from: 'WPHRS', to: 'WETH', amount: 0.2 }
        ]
    },
    
    addLP: {
        enabled: false, // Matikan dulu sampai swap berhasil
        tx_count: 1,
        pairs_and_amounts: [
            { tokenA: 'WPHRS', tokenB: 'WETH', amountA: 0.1 }
        ]
    },
    
    run_in_loop: {
        enabled: false,
        loop_delay_minutes: 60 
    }
};

// ===================================================================================
// KONFIGURASI INTI (BAGIAN INI WAJIB ADA!)
// ===================================================================================

// Alamat-alamat kontrak
export const RPC_URL = "https://testnet.dplabs-internal.com";
export const PHRS_CONTRACT_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const WPHRS_CONTRACT_ADDRESS = "0x3019B247381c850ab53Dc0EE53bCe7A07Ea9155f";
export const USDC_CONTRACT_ADDRESS = "0x72df0bcd7276f2dFbAc900D1CE63c272C4BCcCED";
export const USDT_CONTRACT_ADDRESS = "0xD4071393f8716661958F766DF660033b3d35fD29";
export const WETH_CONTRACT_ADDRESS = "0x4E28826d32F1C398DED160DC16Ac6873357d048f";
export const WBTC_CONTRACT_ADDRESS = "0x8275c526d1bCEc59a31d673929d3cE8d108fF5c7";
export const MIXSWAP_ROUTER_ADDRESS = "0x3541423f25A1Ca5C98fdBCf478405d3f0aaD1164"; // Dodoex (Tidak dipakai lagi untuk swap)
export const POOL_ROUTER_ADDRESS = "0xf05Af5E9dC3b1dd3ad0C087BD80D7391283775e0"; // Uniswap V2 Router

// Ticker untuk kemudahan pemilihan
export const tickers = {
    PHRS: PHRS_CONTRACT_ADDRESS,
    WPHRS: WPHRS_CONTRACT_ADDRESS,
    USDC: USDC_CONTRACT_ADDRESS,
    USDT: USDT_CONTRACT_ADDRESS,
    WETH: WETH_CONTRACT_ADDRESS,
    WBTC: WBTC_CONTRACT_ADDRESS,
};

// Application Binary Interface (ABI) yang dibutuhkan
export const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function deposit() payable",
    "function withdraw(uint256 wad)"
];

// ABI untuk Router Uniswap V2 - DILENGKAPI FUNGSI SWAP
export const UNISWAP_V2_ABI = [
    "function getAmountsOut(uint256 amountIn, address[] memory path) view returns (uint256[] memory amounts)", // 'fees' dihapus karena tidak standar di Uniswap V2
    "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256, uint256, uint256)", // 'fee' dihapus
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)"
];
