// index.js
import { ethers, MaxUint256 } from 'ethers';
import axios from 'axios';
import chalk from 'chalk';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import dotenv from 'dotenv';

import * as config from './config.js';

dotenv.config();

// Ambil konfigurasi dari config.js
const settings = config.AUTOMATION_CONFIG;

// ===================================================================================
// UTILITIES - Fungsi-fungsi pembantu
// ===================================================================================

const log = (message) => {
    const timeZone = 'Asia/Jakarta';
    const zonedDate = toZonedTime(new Date(), timeZone);
    const time = format(zonedDate, 'yyyy-MM-dd HH:mm:ss', { timeZone });
    console.log(`${chalk.cyan(`[${time}]`)} | ${message}`);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const randomDelay = async () => {
    const delay = Math.floor(Math.random() * (settings.max_delay_seconds - settings.min_delay_seconds + 1) + settings.min_delay_seconds) * 1000;
    if (delay > 0) {
        log(chalk.blue(`Menunggu ${delay / 1000} detik sebelum transaksi berikutnya...`));
        await sleep(delay);
    }
};

// ===================================================================================
// BLOCKCHAIN INTERACTIONS - Fungsi-fungsi interaksi ke blockchain
// ===================================================================================

const provider = new ethers.JsonRpcProvider(config.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

async function getBalance(tokenAddress) {
    if (tokenAddress === config.PHRS_CONTRACT_ADDRESS) {
        const balance = await provider.getBalance(wallet.address);
        return { balance, decimals: 18 };
    }
    const contract = new ethers.Contract(tokenAddress, config.ERC20_ABI, provider);
    const [balance, decimals] = await Promise.all([
        contract.balanceOf(wallet.address),
        contract.decimals()
    ]);
    return { balance, decimals };
}

async function approveToken(tokenAddress, spenderAddress, amount) {
    const tokenContract = new ethers.Contract(tokenAddress, config.ERC20_ABI, wallet);
    const allowance = await tokenContract.allowance(wallet.address, spenderAddress);
    
    if (allowance < amount) {
        log(`Membutuhkan approval untuk token ${tokenAddress}...`);
        const tx = await tokenContract.approve(spenderAddress, MaxUint256);
        log(`Approval transaction dikirim: ${chalk.yellow(tx.hash)}`);
        await tx.wait();
        log(chalk.green('Approval berhasil!'));
        await sleep(5000); // Jeda singkat setelah approval
    } else {
        log(chalk.gray(`Approval sudah cukup untuk token ${tokenAddress}.`));
    }
}

// ===================================================================================
// CORE FUNCTIONS - Fungsi inti (Deposit, Withdraw, Swap, Add LP)
// ===================================================================================

async function performDeposit(amount) {
    const wphrsContract = new ethers.Contract(config.WPHRS_CONTRACT_ADDRESS, config.ERC20_ABI, wallet);
    const amountInWei = ethers.parseEther(amount.toString());
    
    log(`Melakukan deposit ${amount} PHRS menjadi WPHRS...`);
    
    const { balance } = await getBalance(config.PHRS_CONTRACT_ADDRESS);
    if (balance < amountInWei) {
        log(chalk.red(`Saldo PHRS tidak cukup. Saldo: ${ethers.formatEther(balance)}`));
        return;
    }
    
    try {
        const tx = await wphrsContract.deposit({ value: amountInWei });
        log(`Deposit transaction dikirim: ${chalk.yellow(tx.hash)}`);
        const receipt = await tx.wait();
        log(chalk.green(`Deposit berhasil! Block: ${receipt.blockNumber}`));
    } catch (error) {
        log(chalk.red(`Deposit gagal: ${error.message}`));
    }
}

async function performWithdraw(amount) {
    const wphrsContract = new ethers.Contract(config.WPHRS_CONTRACT_ADDRESS, config.ERC20_ABI, wallet);
    const amountInWei = ethers.parseEther(amount.toString());

    log(`Melakukan withdraw ${amount} WPHRS menjadi PHRS...`);

    const { balance } = await getBalance(config.WPHRS_CONTRACT_ADDRESS);
     if (balance < amountInWei) {
        log(chalk.red(`Saldo WPHRS tidak cukup. Saldo: ${ethers.formatEther(balance)}`));
        return;
    }

    try {
        const tx = await wphrsContract.withdraw(amountInWei);
        log(`Withdraw transaction dikirim: ${chalk.yellow(tx.hash)}`);
        const receipt = await tx.wait();
        log(chalk.green(`Withdraw berhasil! Block: ${receipt.blockNumber}`));
    } catch (error) {
        log(chalk.red(`Withdraw gagal: ${error.message}`));
    }
}

async function performSwap(fromToken, toToken, amount) {
    log(`Mempersiapkan swap ${amount} ${fromToken.name} ke ${toToken.name}...`);
    
    const { balance, decimals } = await getBalance(fromToken.address);
    const amountInSmallestUnit = ethers.parseUnits(amount.toString(), decimals);

    if (balance < amountInSmallestUnit) {
        log(chalk.red(`Saldo ${fromToken.name} tidak cukup. Saldo: ${ethers.formatUnits(balance, decimals)}`));
        return;
    }

    const url = `https://api.dodoex.io/route-service/v2/widget/getdodoroute?chainId=688688&deadLine=${Math.floor(Date.now() / 1000) + 300}&apikey=a37546505892e1a952&slippage=1&fromTokenAddress=${fromToken.address}&toTokenAddress=${toToken.address}&userAddr=${wallet.address}&estimateGas=true&fromAmount=${amountInSmallestUnit}`;
    
    let route;
    try {
        const response = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" }
        });
        if (response.data.status !== 200) throw new Error(response.data.data);
        route = response.data.data;
        log('Rute swap berhasil didapatkan dari Dodoex.');
    } catch (error) {
        log(chalk.red(`Gagal mendapatkan rute swap: ${error.message}`));
        return;
    }

    if (fromToken.address !== config.PHRS_CONTRACT_ADDRESS) {
        await approveToken(fromToken.address, route.to, amountInSmallestUnit);
    }
    
    const txData = {
        to: route.to,
        data: route.data,
        value: route.value,
        gasLimit: BigInt(route.gasLimit) + BigInt(50000),
        gasPrice: ethers.parseUnits('1', 'gwei')
    };

    try {
        const tx = await wallet.sendTransaction(txData);
        log(`Swap transaction dikirim: ${chalk.yellow(tx.hash)}`);
        const receipt = await tx.wait();
        log(chalk.green(`Swap dari ${fromToken.name} ke ${toToken.name} berhasil! Block: ${receipt.blockNumber}`));
    } catch (error) {
        log(chalk.red(`Swap gagal: ${error.message}`));
    }
}

async function performAddLiquidity(tokenA, tokenB, amountA) {
    log(`Mempersiapkan penambahan likuiditas untuk ${amountA} ${tokenA.name} dan ${tokenB.name}...`);
    
    const { balance: balanceA, decimals: decimalsA } = await getBalance(tokenA.address);
    const amountAInSmallestUnit = ethers.parseUnits(amountA.toString(), decimalsA);

    if (balanceA < amountAInSmallestUnit) {
        log(chalk.red(`Saldo ${tokenA.name} tidak cukup. Saldo: ${ethers.formatUnits(balanceA, decimalsA)}`));
        return;
    }
    
    const poolRouter = new ethers.Contract(config.POOL_ROUTER_ADDRESS, config.UNISWAP_V2_ABI, provider);
    const amountsOut = await poolRouter.getAmountsOut(amountAInSmallestUnit, [tokenA.address, tokenB.address], [30]);
    const amountBInSmallestUnit = amountsOut[1];

    const { balance: balanceB, decimals: decimalsB } = await getBalance(tokenB.address);
     if (balanceB < amountBInSmallestUnit) {
        log(chalk.red(`Saldo ${tokenB.name} tidak cukup. Saldo: ${ethers.formatUnits(balanceB, decimalsB)}, Dibutuhkan: ${ethers.formatUnits(amountBInSmallestUnit, decimalsB)}`));
        return;
    }
    log(`Dibutuhkan ${ethers.formatUnits(amountBInSmallestUnit, decimalsB)} ${tokenB.name} untuk likuiditas.`);

    await approveToken(tokenA.address, config.POOL_ROUTER_ADDRESS, amountAInSmallestUnit);
    await approveToken(tokenB.address, config.POOL_ROUTER_ADDRESS, amountBInSmallestUnit);

    const lpContract = new ethers.Contract(config.POOL_ROUTER_ADDRESS, config.UNISWAP_V2_ABI, wallet);
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const slippage = 0.5;
    const amountAMin = amountAInSmallestUnit - (amountAInSmallestUnit * BigInt(slippage * 100)) / BigInt(10000);
    const amountBMin = amountBInSmallestUnit - (amountBInSmallestUnit * BigInt(slippage * 100)) / BigInt(10000);

    try {
        const tx = await lpContract.addLiquidity(
            tokenA.address, tokenB.address, 30,
            amountAInSmallestUnit, amountBInSmallestUnit,
            amountAMin, amountBMin,
            wallet.address, deadline
        );
        log(`Add Liquidity transaction dikirim: ${chalk.yellow(tx.hash)}`);
        const receipt = await tx.wait();
        log(chalk.green(`Add Liquidity berhasil! Block: ${receipt.blockNumber}`));
    } catch(error) {
        log(chalk.red(`Add Liquidity gagal: ${error.message}`));
    }
}


// ===================================================================================
// MAIN EXECUTION LOGIC
// ===================================================================================

async function runBot() {
    log(chalk.bold.green('Memulai eksekusi bot otomatis...'));
    log(`Menggunakan alamat: ${chalk.green(wallet.address)}`);
    
    for (const task of settings.execution_order) {
        log(chalk.bold.magenta(`\n--- Menjalankan Tugas: ${task.toUpperCase()} ---`));

        switch (task) {
            case 'deposit':
                if (settings.deposit.enabled) {
                    await performDeposit(settings.deposit.amount);
                } else {
                    log(chalk.yellow('Deposit dinonaktifkan, dilewati.'));
                }
                break;
            
            case 'withdraw':
                if (settings.withdraw.enabled) {
                    await performWithdraw(settings.withdraw.amount);
                } else {
                    log(chalk.yellow('Withdraw dinonaktifkan, dilewati.'));
                }
                break;

            case 'swap':
                if (settings.swap.enabled) {
                    for (let i = 0; i < settings.swap.tx_count; i++) {
                        log(chalk.blue(`Melakukan swap ke-${i + 1} dari ${settings.swap.tx_count}...`));
                        const pair = settings.swap.pairs_and_amounts[Math.floor(Math.random() * settings.swap.pairs_and_amounts.length)];
                        
                        const fromToken = { name: pair.from, address: config.tickers[pair.from] };
                        const toToken = { name: pair.to, address: config.tickers[pair.to] };

                        await performSwap(fromToken, toToken, pair.amount);
                        if (i < settings.swap.tx_count - 1) await randomDelay();
                    }
                } else {
                    log(chalk.yellow('Swap dinonaktifkan, dilewati.'));
                }
                break;
            
            case 'addLP':
                if (settings.addLP.enabled) {
                    for (let i = 0; i < settings.addLP.tx_count; i++) {
                        log(chalk.blue(`Melakukan Add LP ke-${i + 1} dari ${settings.addLP.tx_count}...`));
                        const pair = settings.addLP.pairs_and_amounts[Math.floor(Math.random() * settings.addLP.pairs_and_amounts.length)];
                        
                        const tokenA = { name: pair.tokenA, address: config.tickers[pair.tokenA] };
                        const tokenB = { name: pair.tokenB, address: config.tickers[pair.tokenB] };

                        await performAddLiquidity(tokenA, tokenB, pair.amountA);
                        if (i < settings.addLP.tx_count - 1) await randomDelay();
                    }
                } else {
                    log(chalk.yellow('Add LP dinonaktifkan, dilewati.'));
                }
                break;

            default:
                log(chalk.red(`Tugas tidak dikenal: ${task}`));
        }
    }
}


async function start() {
    while (true) {
        await runBot().catch(err => {
            console.error(chalk.red.bold('Terjadi error fatal pada eksekusi bot:'), err);
        });

        if (settings.run_in_loop.enabled) {
            const delayMinutes = settings.run_in_loop.loop_delay_minutes;
            log(chalk.bold.green(`\n=== Siklus selesai. Bot akan berjalan lagi dalam ${delayMinutes} menit. ===`));
            await sleep(delayMinutes * 60 * 1000);
        } else {
            log(chalk.bold.green('\n=== Semua tugas selesai. Bot berhenti. ==='));
            break; // Keluar dari loop while
        }
    }
}

start();
