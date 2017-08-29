const ForceEther = artifacts.require("ForceEther");

export default async (address, amountWei) => {
  const forceEther = await ForceEther.new({ value: amountWei });
  await forceEther.pay(address);
};
