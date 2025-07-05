import os from 'os'; // Tidak dipakai, tapi sebagai contoh import modul bawaan
import { ethers, MaxUint256 } from 'ethers';
import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';
import moment from 'moment-timezone';

// Inisialisasi Dotenv
dotenv.config();

// Helper untuk log dengan timestamp
const log = (message) => {
    const timestamp = moment().tz('Asia/Jakarta').format('HH:mm:ss');
    console.log(`${chalk.bold.cyan(`[${timestamp}]`)} | ${message}`);
};

// Helper untuk jeda waktu (delay)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- KONFIGURASI --- //
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || "https://testnet.dplabs-internal.com";

const JUMLAH_SWAP = 8;
const JUMLAH_TAMBAH_LP = 5;

const SWAP_AMOUNTS = {
    "PHRS": "0.001", "WPHRS": "0.001", "USDC": "0.01",
    "USDT": "0.01", "WETH": "0.00001", "WBTC": "0.000001",
};
const ADD_LP_AMOUNTS = {
    "WPHRS": "0.001", "USDC": "0.01", "USDT": "0.01",
    "WETH": "0.00001", "WBTC": "0.000001",
};

const JEDA_MINIMUM = 30 * 1000; // dalam milidetik
const JEDA_MAKSIMUM = 70 * 1000; // dalam milidetik
// --- AKHIR KONFIGURASI --- //

class Faroswap {
    constructor(rpcUrl) {
        this.HEADERS = { 
            "Accept": "application/json, text/plain, */*", 
            "Origin": "https://faroswap.xyz", 
            "Referer": "https://faroswap.xyz/", 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36" 
        };
        this.chainId = 688688;

        // Alamat Kontrak
        this.PHRS_CONTRACT_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
        this.WPHRS_CONTRACT_ADDRESS = "0x3019B247381c850ab53Dc0EE53bCe7A07Ea9155f";
        this.USDC_CONTRACT_ADDRESS = "0x72df0bcd7276f2dFbAc900D1CE63c272C4BCcCED";
        this.USDT_CONTRACT_ADDRESS = "0xD4071393f8716661958F766DF660033b3d35fD29";
        this.WETH_CONTRACT_ADDRESS = "0x4E28826d32F1C398DED160DC16Ac6873357d048f";
        this.WBTC_CONTRACT_ADDRESS = "0x8275c526d1bCEc59a31d673929d3cE8d108fF5c7";
        this.MIXSWAP_ROUTER_ADDRESS = "0x3541423f25A1Ca5C98fdBCf478405d3f0aaD1164"; // DODO router
        this.POOL_ROUTER_ADDRESS = "0xf05Af5E9dC3b1dd3ad0C087BD80D7391283775e0";

        this.tickers = ["WPHRS", "USDC", "USDT", "WETH", "WBTC"];
        
        // ABI (Application Binary Interface) - sama seperti di Python
        this.ERC20_CONTRACT_ABI = [{"type":"function","name":"balanceOf","stateMutability":"view","inputs":[{"name":"address","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"type":"function","name":"allowance","stateMutability":"view","inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"type":"function","name":"approve","stateMutability":"nonpayable","inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},{"type":"function","name":"decimals","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint8"}]}];
        this.UNISWAP_V2_ABI = [{"type":"function","name":"getAmountsOut","stateMutability":"view","inputs":[{"name":"amountIn","type":"uint256"},{"name":"path","type":"address[]"},{"name":"fees","type":"uint256[]"}],"outputs":[{"name":"amounts","type":"uint256[]"}]},{"type":"function","name":"addLiquidity","stateMutability":"payable","inputs":[{"name":"tokenA","type":"address"},{"name":"tokenB","type":"address"},{"name":"fee","type":"uint256"},{"name":"amountADesired","type":"uint256"},{"name":"amountBDesired","type":"uint256"},{"name":"amountAMin","type":"uint256"},{"name":"amountBMin","type":"uint256"},{"name":"to","type":"address"},{"name":"deadline","type":"uint256"}],"outputs":[{"name":"amountA","type":"uint256"},{"name":"amountB","type":"uint256"},{"name":"liquidity","type":"uint256"}]}];
        
        // Inisialisasi provider dan wallet dari ethers.js
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        // Pool contract instance
        this.poolContract = new ethers.Contract(this.POOL_ROUTER_ADDRESS, this.UNISWAP_V2_ABI, this.provider);
    }

    async getTokenBalance(address, contractAddress) {
        try {
            if (contractAddress === this.PHRS_CONTRACT_ADDRESS) {
                const balanceWei = await this.provider.getBalance(address);
                return ethers.formatEther(balanceWei); // Konversi dari Wei ke Ether
            } else {
                const tokenContract = new ethers.Contract(contractAddress, this.ERC20_CONTRACT_ABI, this.provider);
                const balanceBigInt = await tokenContract.balanceOf(address);
                const decimals = await tokenContract.decimals();
                return ethers.formatUnits(balanceBigInt, decimals); // Konversi dari unit terkecil ke unit standar
            }
        } catch (e) {
            log(chalk.red(`Gagal mendapatkan saldo token: ${e.message}`));
            return '0';
        }
    }

    async waitForReceipt(txHash) {
        log(`Menunggu receipt untuk transaksi: ${chalk.yellow(txHash)}`);
        for (let i = 0; i < 10; i++) {
            try {
                // ethers.js punya cara yang lebih simpel untuk menunggu receipt
                const receipt = await this.provider.waitForTransaction(txHash, 1, 60000); // (hash, konfirmasi, timeout)
                if (receipt && receipt.status === 1) {
                    log(chalk.green(`Transaksi sukses! Block: ${receipt.blockNumber}`));
                    log(`Explorer: https://testnet.pharosscan.xyz/tx/${txHash}`);
                    return receipt;
                } else {
                    log(chalk.red(`Transaksi gagal (reverted).`));
                    return null;
                }
            } catch (error) {
                 log(chalk.yellow(`Menunggu receipt... (${i + 1}/10)`));
                 await sleep(15000); // 15 detik
            }
        }
        log(chalk.red(`Gagal mendapatkan receipt transaksi setelah beberapa kali percobaan.`));
        return null;
    }

    async approveToken(wallet, spenderAddress, tokenAddress, amountWei) {
        const tokenContract = new ethers.Contract(tokenAddress, this.ERC20_CONTRACT_ABI, wallet);
        try {
            const allowance = await tokenContract.allowance(wallet.address, spenderAddress);
            if (allowance >= amountWei) {
                log(chalk.green(`Allowance sudah cukup, tidak perlu approve.`));
                return true;
            }

            log(`Memerlukan approval untuk token ${tokenAddress}...`);
            const approveTx = await tokenContract.approve(spenderAddress, MaxUint256); // Approve jumlah maksimum
            
            const receipt = await this.waitForReceipt(approveTx.hash);
            return receipt !== null;
        } catch (e) {
            log(chalk.red(`Gagal saat proses approve: ${e.message}`));
            return false;
        }
    }

    async getDodoRoute(fromToken, toToken, amountWei, userAddress) {
        const url = `https://api.dodoex.io/route-service/v2/widget/getdodoroute?chainId=${this.chainId}&deadLine=${Math.floor(Date.now() / 1000) + 300}&apikey=a37546505892e1a952&slippage=1&fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&fromAmount=${amountWei}&userAddr=${userAddress}&estimateGas=true`;
        try {
            const response = await axios.get(url, { headers: this.HEADERS, timeout: 30000 });
            if (response.data && response.data.status === 200) {
                return response.data.data;
            } else {
                log(chalk.red(`DODO API Error: ${response.data.data || 'Tidak ada rute'}`));
                return null;
            }
        } catch (e) {
            log(chalk.red(`Gagal mendapatkan rute dari DODOEX: ${e.message}`));
            return null;
        }
    }
    
    getContractAddress(ticker) {
        return this[`${ticker}_CONTRACT_ADDRESS`] || this.PHRS_CONTRACT_ADDRESS;
    }

    async performSwap(wallet, fromTicker, toTicker, amountDecimal) {
        const fromTokenAddress = this.getContractAddress(fromTicker);
        const toTokenAddress = this.getContractAddress(toTicker);

        const balance = await this.getTokenBalance(wallet.address, fromTokenAddress);
        if (parseFloat(balance) < parseFloat(amountDecimal)) {
            log(chalk.red(`Saldo ${fromTicker} tidak cukup. Saldo: ${balance}, butuh: ${amountDecimal}`));
            return false;
        }
        
        let decimals;
        if (fromTicker === "PHRS") {
            decimals = 18;
        } else {
            const tokenContract = new ethers.Contract(fromTokenAddress, this.ERC20_CONTRACT_ABI, this.provider);
            decimals = await tokenContract.decimals();
        }

        const amountWei = ethers.parseUnits(amountDecimal, Number(decimals));

        log(`Memulai swap: ${amountDecimal} ${fromTicker} -> ${toTicker}`);
        const routeData = await this.getDodoRoute(fromTokenAddress, toTokenAddress, amountWei.toString(), wallet.address);
        if (!routeData) return false;

        if (fromTicker !== "PHRS") {
            const approved = await this.approveToken(wallet, routeData.to, fromTokenAddress, amountWei);
            if (!approved) {
                log(chalk.red(`Gagal approve token, swap dibatalkan.`));
                return false;
            }
        }
        
        const swapTx = {
            to: routeData.to,
            from: wallet.address,
            value: routeData.value || '0',
            data: routeData.data,
            gasPrice: ethers.parseUnits('1', 'gwei'),
            nonce: await this.provider.getTransactionCount(wallet.address, 'latest'),
        };

        try {
            // Ethers.js v6 Wallet secara otomatis mengestimasi gas jika tidak disediakan
            const txResponse = await wallet.sendTransaction(swapTx);
            const receipt = await this.waitForReceipt(txResponse.hash);
            return receipt !== null;
        } catch(e) {
            log(chalk.red(`Gagal mengirim transaksi swap: ${e.message}`));
            return false;
        }
    }

    async performAddLiquidity(wallet, tokenATicker, tokenBTicker, amountADecimal) {
        log(`Memulai Tambah Likuiditas: ${amountADecimal} ${tokenATicker} dengan ${tokenBTicker}`);

        const tokenAAddress = this.getContractAddress(tokenATicker);
        const tokenBAddress = this.getContractAddress(tokenBTicker);
        
        const balanceA = await this.getTokenBalance(wallet.address, tokenAAddress);
        if (parseFloat(balanceA) < parseFloat(amountADecimal)) {
            log(chalk.red(`Saldo ${tokenATicker} tidak cukup. Saldo: ${balanceA}, butuh: ${amountADecimal}`));
            return false;
        }
        
        const tokenAContract = new ethers.Contract(tokenAAddress, this.ERC20_CONTRACT_ABI, wallet);
        const decimalsA = await tokenAContract.decimals();
        const amountAWei = ethers.parseUnits(amountADecimal, Number(decimalsA));

        let amountBWei;
        try {
            const amountsOut = await this.poolContract.getAmountsOut(amountAWei, [tokenAAddress, tokenBAddress], [30]);
            amountBWei = amountsOut[1];
        } catch(e) {
            log(chalk.red(`Gagal menghitung jumlah token B: ${e.message}`));
            return false;
        }
        
        log(chalk.yellow(`Dibutuhkan sekitar ${ethers.formatUnits(amountBWei, await new ethers.Contract(tokenBAddress, this.ERC20_CONTRACT_ABI, this.provider).decimals())} ${tokenBTicker}`));

        log(`Approval untuk ${tokenATicker}...`);
        if (!await this.approveToken(wallet, this.POOL_ROUTER_ADDRESS, tokenAAddress, amountAWei)) return false;

        log(`Approval untuk ${tokenBTicker}...`);
        if (!await this.approveToken(wallet, this.POOL_ROUTER_ADDRESS, tokenBAddress, amountBWei)) return false;
        
        const deadline = Math.floor(Date.now() / 1000) + 600;
        const slippage = 0.01; // 1%
        
        try {
            const lpContractWithSigner = this.poolContract.connect(wallet);
            const tx = await lpContractWithSigner.addLiquidity(
                tokenAAddress,
                tokenBAddress,
                30,
                amountAWei,
                amountBWei,
                amountAWei - (amountAWei * BigInt(Math.floor(slippage * 100))) / 100n, // amountAMin
                amountBWei - (amountBWei * BigInt(Math.floor(slippage * 100))) / 100n, // amountBMin
                wallet.address,
                deadline,
                { gasPrice: ethers.parseUnits('1', 'gwei') }
            );
            const receipt = await this.waitForReceipt(tx.hash);
            return receipt !== null;
        } catch (e) {
            log(chalk.red(`Gagal mengirim transaksi add liquidity: ${e.message}`));
            return false;
        }
    }

    async run() {
        if (!PRIVATE_KEY) {
            log(chalk.red("Error: PRIVATE_KEY tidak ditemukan di file .env."));
            return;
        }

        const wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
        const address = wallet.address;
        log(chalk.bold(`Memulai bot untuk akun: ${address}`));
        log(chalk.bold(`Menggunakan RPC: ${this.provider.getRpcUrl()}`));
        // FASE 1: SWAP
        if (JUMLAH_SWAP > 0) {
            log(chalk.bold(`\n--- Memulai Fase Swap (${JUMLAH_SWAP} kali) ---`));
            for (let i = 0; i < JUMLAH_SWAP; i++) {
                log(chalk.bold(`--- Swap #${i + 1}/${JUMLAH_SWAP} ---`));
                let fromTicker, toTicker;
                
                if (i === 0) {
                    log(chalk.yellow("Info: Swap pertama, memaksa jual PHRS untuk mendapatkan token lain."));
                    fromTicker = "PHRS";
                    toTicker = this.tickers[Math.floor(Math.random() * this.tickers.length)];
                } else {
                    log("Info: Mencari token dengan saldo yang cukup untuk di-swap...");
                    const eligibleTickers = [];
                    const allPossibleTickers = ["PHRS", ...this.tickers];
                    
                    for (const ticker of allPossibleTickers) {
                        const contractAddress = this.getContractAddress(ticker);
                        const balance = await this.getTokenBalance(address, contractAddress);
                        if (parseFloat(balance) > parseFloat(SWAP_AMOUNTS[ticker] || '0')) {
                            eligibleTickers.push(ticker);
                        }
                    }

                    if (eligibleTickers.length === 0) {
                        log(chalk.red("Tidak ada token dengan saldo yang cukup untuk di-swap."));
                        break;
                    }
                    
                    fromTicker = eligibleTickers[Math.floor(Math.random() * eligibleTickers.length)];
                    const tempTickers = ["PHRS", ...this.tickers];
                    do {
                        toTicker = tempTickers[Math.floor(Math.random() * tempTickers.length)];
                    } while (fromTicker === toTicker);
                }

                log(`Dipilih pasangan: ${fromTicker} -> ${toTicker}`);
                await this.performSwap(wallet, fromTicker, toTicker, SWAP_AMOUNTS[fromTicker] || "0.001");

                if (i < JUMLAH_SWAP - 1) {
                    const delay = Math.floor(Math.random() * (JEDA_MAKSIMUM - JEDA_MINIMUM + 1) + JEDA_MINIMUM);
                    log(`Menunggu ${delay / 1000} detik sebelum transaksi berikutnya...`);
                    await sleep(delay);
                }
            }
        }
        
        // FASE 2: TAMBAH LIKUIDITAS (LP)
        if (JUMLAH_TAMBAH_LP > 0) {
            log(chalk.bold(`\n--- Memulai Fase Tambah Likuiditas (${JUMLAH_TAMBAH_LP} kali) ---`));
            for (let i = 0; i < JUMLAH_TAMBAH_LP; i++) {
                log(chalk.bold(`--- Tambah LP #${i + 1}/${JUMLAH_TAMBAH_LP} ---`));
                
                let tokenA, tokenB;
                do {
                    tokenA = this.tickers[Math.floor(Math.random() * this.tickers.length)];
                    tokenB = this.tickers[Math.floor(Math.random() * this.tickers.length)];
                } while (tokenA === tokenB);
                
                const amount = ADD_LP_AMOUNTS[tokenA] || "0.001";
                await this.performAddLiquidity(wallet, tokenA, tokenB, amount);
                
                if (i < JUMLAH_TAMBAH_LP - 1) {
                    const delay = Math.floor(Math.random() * (JEDA_MAKSIMUM - JEDA_MINIMUM + 1) + JEDA_MINIMUM);
                    log(`Menunggu ${delay / 1000} detik sebelum transaksi berikutnya...`);
                    await sleep(delay);
                }
            }
        }

        log(chalk.bold.green(`\nSemua tugas telah selesai untuk akun ${address}.`));
    }
}

// Main execution block
async function main() {
    try {
        const bot = new Faroswap(RPC_URL);
        await bot.run();
    } catch (e) {
        console.log(chalk.red(`\nTerjadi kesalahan fatal: ${e.stack}`));
    }
}

main().catch(console.error);
