// index.js
import { ethers, MaxUint256 } from 'ethers';
import axios from 'axios';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { format, toDate } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import dotenv from 'dotenv';

import * as config from './config.js';

dotenv.config();

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

const randomDelay = async (min, max) => {
    const delay = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
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

log(`Menggunakan alamat: ${chalk.green(wallet.address)}`);

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
        await sleep(3000); // Jeda singkat setelah approval
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
    log(`Mempersiapkan swap dari ${fromToken.name} ke ${toToken.name}...`);
    
    const { balance, decimals } = await getBalance(fromToken.address);
    const amountInSmallestUnit = ethers.parseUnits(amount.toString(), decimals);

    if (balance < amountInSmallestUnit) {
        log(chalk.red(`Saldo ${fromToken.name} tidak cukup. Saldo: ${ethers.formatUnits(balance, decimals)}`));
        return;
    }

    // 1. Dapatkan rute dari Dodo API
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

    // 2. Approve token jika bukan token native (PHRS)
    if (fromToken.address !== config.PHRS_CONTRACT_ADDRESS) {
        await approveToken(fromToken.address, route.to, amountInSmallestUnit);
    }
    
    // 3. Kirim transaksi swap
    const txData = {
        to: route.to,
        data: route.data,
        value: route.value,
        gasLimit: BigInt(route.gasLimit) + BigInt(50000), // Tambah buffer gas
        gasPrice: ethers.parseUnits('1', 'gwei') // Sesuaikan jika perlu
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
    log(`Mempersiapkan penambahan likuiditas untuk ${tokenA.name} dan ${tokenB.name}...`);
    
    const { balance: balanceA, decimals: decimalsA } = await getBalance(tokenA.address);
    const amountAInSmallestUnit = ethers.parseUnits(amountA.toString(), decimalsA);

    if (balanceA < amountAInSmallestUnit) {
        log(chalk.red(`Saldo ${tokenA.name} tidak cukup. Saldo: ${ethers.formatUnits(balanceA, decimalsA)}`));
        return;
    }
    
    // 1. Dapatkan jumlah token B yang dibutuhkan
    const poolRouter = new ethers.Contract(config.POOL_ROUTER_ADDRESS, config.UNISWAP_V2_ABI, provider);
    const amountsOut = await poolRouter.getAmountsOut(amountAInSmallestUnit, [tokenA.address, tokenB.address], [30]);
    const amountBInSmallestUnit = amountsOut[1];

    const { balance: balanceB, decimals: decimalsB } = await getBalance(tokenB.address);
     if (balanceB < amountBInSmallestUnit) {
        log(chalk.red(`Saldo ${tokenB.name} tidak cukup. Saldo: ${ethers.formatUnits(balanceB, decimalsB)}, Dibutuhkan: ${ethers.formatUnits(amountBInSmallestUnit, decimalsB)}`));
        return;
    }
    log(`Dibutuhkan ${ethers.formatUnits(amountBInSmallestUnit, decimalsB)} ${tokenB.name} untuk likuiditas.`);

    // 2. Approve kedua token
    await approveToken(tokenA.address, config.POOL_ROUTER_ADDRESS, amountAInSmallestUnit);
    await approveToken(tokenB.address, config.POOL_ROUTER_ADDRESS, amountBInSmallestUnit);

    // 3. Tambahkan likuiditas
    const lpContract = new ethers.Contract(config.POOL_ROUTER_ADDRESS, config.UNISWAP_V2_ABI, wallet);
    const deadline = Math.floor(Date.now() / 1000) + 600; // 10 menit dari sekarang
    const slippage = 0.5; // 0.5%
    const amountAMin = amountAInSmallestUnit - (amountAInSmallestUnit * BigInt(slippage * 100)) / BigInt(10000);
    const amountBMin = amountBInSmallestUnit - (amountBInSmallestUnit * BigInt(slippage * 100)) / BigInt(10000);

    try {
        const tx = await lpContract.addLiquidity(
            tokenA.address,
            tokenB.address,
            30,
            amountAInSmallestUnit,
            amountBInSmallestUnit,
            amountAMin,
            amountBMin,
            wallet.address,
            deadline
        );
        log(`Add Liquidity transaction dikirim: ${chalk.yellow(tx.hash)}`);
        const receipt = await tx.wait();
        log(chalk.green(`Add Liquidity berhasil! Block: ${receipt.blockNumber}`));
    } catch(error) {
        log(chalk.red(`Add Liquidity gagal: ${error.message}`));
    }
}

// ===================================================================================
// MAIN MENU & EXECUTION
// ===================================================================================

async function main() {
    console.log(chalk.bold.green('=== Faroswap Auto BOT (Node.js Version) ==='));

    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Pilih aksi yang ingin dijalankan:',
            choices: [
                { name: 'Auto Deposit (PHRS -> WPHRS)', value: 'deposit' },
                { name: 'Auto Withdraw (WPHRS -> PHRS)', value: 'withdraw' },
                { name: 'Auto Swap', value: 'swap' },
                { name: 'Auto Add Liquidity', value: 'addLP' },
                new inquirer.Separator(),
                { name: 'Keluar', value: 'exit' },
            ],
        },
    ]);

    if (action === 'exit') {
        log('Terima kasih!');
        return;
    }

    if (action === 'deposit') {
        const { amount } = await inquirer.prompt([{ type: 'number', name: 'amount', message: 'Masukkan jumlah PHRS untuk di-deposit:' }]);
        await performDeposit(amount);
    }

    if (action === 'withdraw') {
        const { amount } = await inquirer.prompt([{ type: 'number', name: 'amount', message: 'Masukkan jumlah WPHRS untuk di-withdraw:' }]);
        await performWithdraw(amount);
    }
    
    if (action === 'swap') {
        const { txCount, minDelay, maxDelay } = await inquirer.prompt([
            { type: 'number', name: 'txCount', message: 'Berapa kali swap?' },
            { type: 'number', name: 'minDelay', message: 'Delay minimum antar transaksi (detik):', default: 5 },
            { type: 'number', name: 'maxDelay', message: 'Delay maksimum antar transaksi (detik):', default: 15 }
        ]);
        
        for (let i = 0; i < txCount; i++) {
            log(chalk.magenta(`--- Menjalankan Swap ke-${i + 1} dari ${txCount} ---`));
            const availableTickers = Object.keys(config.tickers);
            const { fromTickerName } = await inquirer.prompt([{ type: 'list', name: 'fromTickerName', message: 'Swap DARI token:', choices: availableTickers }]);
            const toTickerChoices = availableTickers.filter(t => t !== fromTickerName);
            const { toTickerName } = await inquirer.prompt([{ type: 'list', name: 'toTickerName', message: 'Swap KE token:', choices: toTickerChoices }]);
            const { amount } = await inquirer.prompt([{ type: 'number', name: 'amount', message: `Jumlah ${fromTickerName} yang akan di-swap:` }]);
            
            const fromToken = { name: fromTickerName, address: config.tickers[fromTickerName] };
            const toToken = { name: toTickerName, address: config.tickers[toTickerName] };
            
            await performSwap(fromToken, toToken, amount);
            if (i < txCount - 1) await randomDelay(minDelay, maxDelay);
        }
    }
    
    if (action === 'addLP') {
        const { txCount, minDelay, maxDelay } = await inquirer.prompt([
            { type: 'number', name: 'txCount', message: 'Berapa kali tambah likuiditas?' },
            { type: 'number', name: 'minDelay', message: 'Delay minimum antar transaksi (detik):', default: 5 },
            { type: 'number', name: 'maxDelay', message: 'Delay maksimum antar transaksi (detik):', default: 15 }
        ]);

        for (let i = 0; i < txCount; i++) {
             log(chalk.magenta(`--- Menjalankan Add LP ke-${i + 1} dari ${txCount} ---`));
             const availableTickers = Object.keys(config.tickers).filter(t => t !== 'PHRS'); // Tidak bisa LP dengan PHRS
             const { tokenAName } = await inquirer.prompt([{ type: 'list', name: 'tokenAName', message: 'Pilih token PERTAMA untuk LP:', choices: availableTickers }]);
             const tokenBChoices = availableTickers.filter(t => t !== tokenAName);
             const { tokenBName } = await inquirer.prompt([{ type: 'list', name: 'tokenBName', message: 'Pilih token KEDUA untuk LP:', choices: tokenBChoices }]);
             const { amount } = await inquirer.prompt([{ type: 'number', name: 'amount', message: `Jumlah ${tokenAName} yang akan ditambahkan:` }]);
             
             const tokenA = { name: tokenAName, address: config.tickers[tokenAName] };
             const tokenB = { name: tokenBName, address: config.tickers[tokenBName] };
             
             await performAddLiquidity(tokenA, tokenB, amount);
             if (i < txCount - 1) await randomDelay(minDelay, maxDelay);
        }
    }

    log(chalk.bold.green('=== Selesai ==='));
}


main().catch(err => {
    console.error(chalk.red.bold('Terjadi error fatal:'), err);
    process.exit(1);
});
