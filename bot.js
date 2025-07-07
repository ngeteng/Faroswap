import { ethers, MaxUint256 } from 'ethers';
import chalk from 'chalk';
import dotenv from 'dotenv';
import moment from 'moment-timezone';

// Inisialisasi Dotenv
dotenv.config();

// Helper untuk log dengan timestamp WIB
const log = (message) => {
    const timestamp = moment().tz('Asia/Jakarta').format('HH:mm:ss');
    console.log(`${chalk.bold.cyan(`[${timestamp}]`)} | ${message}`);
};

// Helper untuk jeda waktu (delay)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- KONFIGURASI --- //
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || "https://testnet.dplabs-internal.com";
const WRAP_AMOUNT = process.env.WRAP_AMOUNT || "0.01";

const JUMLAH_SWAP = 5;
const JUMLAH_TAMBAH_LP = 5;

const SWAP_AMOUNTS = {
    "WPHRS": "0.001", "USDC": "0.01", "USDT": "0.01",
    "WETH": "0.00001", "WBTC": "0.000001",
};
const ADD_LP_AMOUNTS = {
    "WPHRS": "0.001", "USDC": "0.01", "USDT": "0.01",
    "WETH": "0.00001", "WBTC": "0.000001",
};

const JEDA_MINIMUM = 30 * 1000; // 30 detik
const JEDA_MAKSIMUM = 70 * 1000; // 70 detik
// --- AKHIR KONFIGURASI --- //

class Faroswap {
    constructor(rpcUrl) {
        this.rpcUrl = rpcUrl;
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
        
        // --- KONTRAK & ALAMAT ---
        this.PHRS_CONTRACT_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
        this.WPHRS_CONTRACT_ADDRESS = "0x3019B247381c850ab53Dc0EE53bCe7A07Ea9155f";
        this.USDC_CONTRACT_ADDRESS = "0x72df0bcd7276f2dFbAc900D1CE63c272C4BCcCED";
        this.USDT_CONTRACT_ADDRESS = "0xD4071393f8716661958F766DF660033b3d35fD29";
        this.WETH_CONTRACT_ADDRESS = "0x4E28826d32F1C398DED160DC16Ac6873357d048f";
        this.WBTC_CONTRACT_ADDRESS = "0x8275c526d1bCEc59a31d673929d3cE8d108fF5c7";
        
        // --- PERBAIKAN --- Memisahkan Router Swap dan Router LP
        this.MIXSWAP_ROUTER_ADDRESS = "0x3541423f25A1Ca5C98fdBCf478405d3f0aaD1164";
        this.POOL_ROUTER_ADDRESS = "0xf05Af5E9dC3b1dd3ad0C087BD80D7391283775e0";
        
        this.tickers = ["WPHRS", "USDC", "USDT", "WETH", "WBTC"];

        this.ERC20_ABI = [{"type":"function","name":"balanceOf","stateMutability":"view","inputs":[{"name":"address","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"type":"function","name":"allowance","stateMutability":"view","inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"type":"function","name":"approve","stateMutability":"nonpayable","inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},{"type":"function","name":"decimals","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint8"}]},{"type":"function","name":"symbol","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"string"}]}];
        this.WPHRS_ABI = [...this.ERC20_ABI, {"type":"function","name":"deposit","stateMutability":"payable","inputs":[],"outputs":[]},{"type":"function","name":"withdraw","stateMutability":"nonpayable","inputs":[{"name":"amount","type":"uint256"}],"outputs":[]}];
        this.UNISWAP_V2_ROUTER_ABI = [{"type":"function","name":"getAmountsOut","stateMutability":"view","inputs":[{"name":"amountIn","type":"uint256"},{"name":"path","type":"address[]"},{"name":"fees","type":"uint256[]"}],"outputs":[{"name":"amounts","type":"uint256[]"}]},{"type":"function","name":"addLiquidity","stateMutability":"payable","inputs":[{"name":"tokenA","type":"address"},{"name":"tokenB","type":"address"},{"name":"fee","type":"uint256"},{"name":"amountADesired","type":"uint256"},{"name":"amountBDesired","type":"uint256"},{"name":"amountAMin","type":"uint256"},{"name":"amountBMin","type":"uint256"},{"name":"to","type":"address"},{"name":"deadline","type":"uint256"}],"outputs":[{"name":"amountA","type":"uint256"},{"name":"amountB","type":"uint256"},{"name":"liquidity","type":"uint256"}]},{"type":"function","name":"swapExactTokensForTokens","stateMutability":"nonpayable","inputs":[{"name":"amountIn","type":"uint256"},{"name":"amountOutMin","type":"uint256"},{"name":"path","type":"address[]"},{"name":"to","type":"address"},{"name":"deadline","type":"uint256"}],"outputs":[{"name":"amounts","type":"uint256[]"}]}];
        
        // --- PERBAIKAN --- Membuat instance untuk kedua router
        this.mixSwapContract = new ethers.Contract(this.MIXSWAP_ROUTER_ADDRESS, this.UNISWAP_V2_ROUTER_ABI, this.provider);
        this.poolContract = new ethers.Contract(this.POOL_ROUTER_ADDRESS, this.UNISWAP_V2_ROUTER_ABI, this.provider);
        this.wphrsContract = new ethers.Contract(this.WPHRS_CONTRACT_ADDRESS, this.WPHRS_ABI, this.provider);
    }
    
    getContractAddress(ticker) {
        if (ticker === "PHRS") return this.PHRS_CONTRACT_ADDRESS;
        return this[`${ticker}_CONTRACT_ADDRESS`];
    }

    async waitForReceipt(txHash) {
        log(`Menunggu receipt untuk transaksi: ${chalk.yellow(txHash)}`);
        try {
            const receipt = await this.provider.waitForTransaction(txHash, 1, 180000);
            if (receipt && receipt.status === 1) {
                log(chalk.green(`Transaksi sukses! Explorer: https://testnet.pharosscan.xyz/tx/${txHash}`));
                return receipt;
            } else {
                log(chalk.red(`Transaksi gagal (reverted). Explorer: https://testnet.pharosscan.xyz/tx/${txHash}`));
                return null;
            }
        } catch (error) {
            log(chalk.red(`Gagal menunggu receipt: ${error.message}`));
            return null;
        }
    }
    
    async approveToken(wallet, spenderAddress, tokenAddress, amountWei) {
        const tokenContract = new ethers.Contract(tokenAddress, this.ERC20_ABI, wallet);
        try {
            const allowance = await tokenContract.allowance(wallet.address, spenderAddress);
            if (allowance >= amountWei) {
                log(chalk.green(`Allowance sudah cukup untuk ${await tokenContract.symbol()} ke ${spenderAddress.slice(0,6)}...`));
                return true;
            }
            log(`Memerlukan approval untuk ${await tokenContract.symbol()} ke ${spenderAddress.slice(0,6)}...`);
            const approveTx = await tokenContract.approve(spenderAddress, MaxUint256);
            const receipt = await this.waitForReceipt(approveTx.hash);
            return receipt !== null;
        } catch (e) {
            log(chalk.red(`Gagal saat proses approve: ${e.message}`));
            return false;
        }
    }

    async performSwap(wallet, fromTicker, toTicker, amountDecimal) {
        log(`Memulai swap: ${amountDecimal} ${fromTicker} -> ${toTicker}`);
        const fromTokenAddress = this.getContractAddress(fromTicker);
        const toTokenAddress = this.getContractAddress(toTicker);

        try {
            let tx;
            const fromTokenContract = new ethers.Contract(fromTokenAddress, this.ERC20_ABI, this.provider);
            const fromDecimals = (fromTicker === 'PHRS') ? 18 : await fromTokenContract.decimals();
            const amountWei = ethers.parseUnits(amountDecimal.toString(), Number(fromDecimals));

            if (fromTicker === 'PHRS' && toTicker === 'WPHRS') {
                const wphrsSigner = this.wphrsContract.connect(wallet);
                tx = await wphrsSigner.deposit({ value: amountWei });
            }
            else if (fromTicker === 'WPHRS' && toTicker === 'PHRS') {
                const wphrsSigner = this.wphrsContract.connect(wallet);
                tx = await wphrsSigner.withdraw(amountWei);
            }
            else {
                // --- PERBAIKAN --- Approval dan swap sekarang ke MIXSWAP_ROUTER_ADDRESS
                if (!await this.approveToken(wallet, this.MIXSWAP_ROUTER_ADDRESS, fromTokenAddress, amountWei)) {
                     log(chalk.red(`Gagal approve, swap dibatalkan.`));
                     return false;
                }
                
                let path;
                if (fromTicker !== 'WPHRS' && toTicker !== 'WPHRS') {
                    path = [fromTokenAddress, this.WPHRS_CONTRACT_ADDRESS, toTokenAddress];
                } else {
                    path = [fromTokenAddress, toTokenAddress];
                }

                const deadline = Math.floor(Date.now() / 1000) + 600;
                const mixSwapContractSigner = this.mixSwapContract.connect(wallet);
                tx = await mixSwapContractSigner.swapExactTokensForTokens(
                    amountWei, 0, path, wallet.address, deadline
                );
            }
            const receipt = await this.waitForReceipt(tx.hash);
            return receipt !== null;
        } catch (e) {
            log(chalk.red(`Error saat ${fromTicker}->${toTicker} swap: ${e.message}`));
            return false;
        }
    }
    
    async performAddLiquidity(wallet, tokenATicker, tokenBTicker, amountADecimal) {
        log(`Memulai Tambah Likuiditas: ${amountADecimal} ${tokenATicker} dengan ${tokenBTicker}`);
        const tokenAAddress = this.getContractAddress(tokenATicker);
        const tokenBAddress = this.getContractAddress(tokenBTicker);
        
        if (!amountADecimal || parseFloat(amountADecimal) <= 0) return false;

        const balanceA = await this.getTokenBalance(wallet.address, tokenAAddress);
        if (parseFloat(balanceA) < parseFloat(amountADecimal)) return false;
        
        const tokenAContract = new ethers.Contract(tokenAAddress, this.ERC20_ABI, this.provider);
        const decimalsA = await tokenAContract.decimals();
        const amountAWei = ethers.parseUnits(amountADecimal.toString(), Number(decimalsA));

        let amountBWei;
        try {
            const amountsOut = await this.poolContract.getAmountsOut(amountAWei, [tokenAAddress, tokenBAddress], [30]);
            amountBWei = amountsOut[1];
        } catch(e) {
            log(chalk.red(`Gagal menghitung jumlah token B: ${e.message}`)); return false;
        }
        
        const tokenBContract = new ethers.Contract(tokenBAddress, this.ERC20_ABI, this.provider);
        const tokenBDecimals = await tokenBContract.decimals();
        const amountBDecimal = ethers.formatUnits(amountBWei, Number(tokenBDecimals));
        log(chalk.yellow(`Dibutuhkan sekitar ${amountBDecimal} ${tokenBTicker}`));

        const balanceB = await this.getTokenBalance(wallet.address, tokenBAddress);
        if (parseFloat(balanceB) < parseFloat(amountBDecimal)) return false;

        // --- PERBAIKAN --- Approval untuk likuiditas tetap ke POOL_ROUTER_ADDRESS
        if (!await this.approveToken(wallet, this.POOL_ROUTER_ADDRESS, tokenAAddress, amountAWei)) return false;
        if (!await this.approveToken(wallet, this.POOL_ROUTER_ADDRESS, tokenBAddress, amountBWei)) return false;
        
        try {
            const lpContractWithSigner = this.poolContract.connect(wallet);
            const deadline = Math.floor(Date.now() / 1000) + 600;
            const tx = await lpContractWithSigner.addLiquidity(
                tokenAAddress, tokenBAddress, 30, amountAWei, amountBWei,
                (amountAWei * 95n) / 100n, (amountBWei * 95n) / 100n,
                wallet.address, deadline
            );
            return await this.waitForReceipt(tx.hash) !== null;
        } catch (e) {
            log(chalk.red(`Gagal mengirim transaksi add liquidity: ${e.message}`));
            return false;
        }
    }

    async run() {
        if (!PRIVATE_KEY) {
            log(chalk.red("Error: PRIVATE_KEY tidak ditemukan di file .env.")); return;
        }
        const wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
        log(chalk.bold(`Memulai bot untuk akun: ${wallet.address}`));

        log(chalk.bold.magenta(`\n--- TAHAP 0: Membungkus ${WRAP_AMOUNT} PHRS menjadi WPHRS ---`));
        const phrsBalance = await this.getTokenBalance(wallet.address, this.PHRS_CONTRACT_ADDRESS);
        if (parseFloat(phrsBalance) < parseFloat(WRAP_AMOUNT)) {
             log(chalk.red(`Saldo PHRS tidak cukup untuk wrap.`));
        } else {
             await this.performSwap(wallet, "PHRS", "WPHRS", WRAP_AMOUNT);
             await sleep(JEDA_MINIMUM);
        }
       
        if (JUMLAH_SWAP > 0) {
            log(chalk.bold(`\n--- Memulai Fase Swap (${JUMLAH_SWAP} kali) ---`));
            for (let i = 0; i < JUMLAH_SWAP; i++) {
                log(chalk.bold(`--- Swap #${i + 1}/${JUMLAH_SWAP} ---`));
                const eligibleTickers = [];
                for (const ticker of this.tickers) {
                    const balance = await this.getTokenBalance(wallet.address, this.getContractAddress(ticker));
                    if (parseFloat(balance) > parseFloat(SWAP_AMOUNTS[ticker] || '0')) eligibleTickers.push(ticker);
                }
                if (eligibleTickers.length < 1) { log(chalk.red("Saldo token tidak cukup untuk swap.")); break; }
                const fromTicker = eligibleTickers[Math.floor(Math.random() * eligibleTickers.length)];
                let toTicker;
                do { toTicker = this.tickers[Math.floor(Math.random() * this.tickers.length)]; } while (fromTicker === toTicker);
                log(`Dipilih pasangan: ${fromTicker} -> ${toTicker}`);
                await this.performSwap(wallet, fromTicker, toTicker, SWAP_AMOUNTS[fromTicker]);
                if (i < JUMLAH_SWAP - 1 || JUMLAH_TAMBAH_LP > 0) await sleep(Math.floor(Math.random() * (JEDA_MAKSIMUM - JEDA_MINIMUM + 1) + JEDA_MINIMUM));
            }
        }
        
        if (JUMLAH_TAMBAH_LP > 0) {
            log(chalk.bold(`\n--- Memulai Fase Tambah Likuiditas (${JUMLAH_TAMBAH_LP} kali) ---`));
            const lpTickers = this.tickers.filter(t => t !== 'WPHRS');
            for (let i = 0; i < JUMLAH_TAMBAH_LP; i++) {
                log(chalk.bold(`--- Tambah LP #${i + 1}/${JUMLAH_TAMBAH_LP} ---`));
                if (lpTickers.length === 0) { log(chalk.red("Tidak ada token lain untuk dipasangkan dengan WPHRS.")); break; }
                const tokenA = lpTickers[Math.floor(Math.random() * lpTickers.length)];
                log(`Memilih pasangan LP: ${tokenA} - WPHRS`);
                await this.performAddLiquidity(wallet, tokenA, 'WPHRS', ADD_LP_AMOUNTS[tokenA]);
                if (i < JUMLAH_TAMBAH_LP - 1) await sleep(Math.floor(Math.random() * (JEDA_MAKSIMUM - JEDA_MINIMUM + 1) + JEDA_MINIMUM));
            }
        }
        log(chalk.bold.green(`\nSemua tugas telah selesai.`));
    }
    
    async getTokenBalance(address, contractAddress) {
        try {
            if (contractAddress === this.PHRS_CONTRACT_ADDRESS) {
                return ethers.formatEther(await this.provider.getBalance(address));
            } else {
                const tokenContract = new ethers.Contract(contractAddress, this.ERC20_ABI, this.provider);
                const balance = await tokenContract.balanceOf(address);
                const decimals = await tokenContract.decimals();
                return ethers.formatUnits(balance, Number(decimals));
            }
        } catch (e) {
            return '0';
        }
    }
}

async function main() {
    try {
        const bot = new Faroswap(RPC_URL);
        await bot.run();
    } catch (e) {
        log(chalk.red(`\nTerjadi kesalahan fatal: ${e.stack}`));
    }
}

main();
