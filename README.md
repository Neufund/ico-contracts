# Hackathon contracts


ICO Monitor requirements:

(See ICO monitor documentation)

1. Money in escrow until ICO is succesful, full automatic refund of ICO failure.



TODO



* Commit to the curve, make it immutable.
*



* OPTIONAL: Spot prices during Ethereum ICO.


## Profiling the build/test process

```
node --inspect-brk ./node_modules/.bin/truffle test
chromium-browser 'chrome://inspect'
```


### Using perf


Install tools and configure system:

```
sudo apt install linux-tools-generic linux-cloud-tools-generic
echo -1 | sudo tee /proc/sys/kernel/perf_event_paranoid
echo 0 | sudo tee /proc/sys/kernel/kptr_restrict
```


Record and display a flame graph:

```
perf record -F 100 -g -- node --perf_basic_prof --perf_prof_unwinding_info ./node_modules/.bin/truffle test
```

```
git clone --depth 1 http://github.com/brendangregg/FlameGraph
perf script | ./FlameGraph/stackcollapse-perf.pl  | ./FlameGraph/flamegraph.pl --colors js > flamegraph.svg
chromium-browser ./flamegraph.svg
```


```
yarn add -D stackvis
perf script > pre
cat pre | egrep -v "( __libc_start| LazyCompile | v8::internal::| Builtin:| Stub:| LoadIC:|\[unknown\]| LoadPolymorphicIC:)" | sed 's/ LazyCompile:[*~]\?/ /' > post
cat post | yarn run -- stackvis perf > flamegraph.html
chromium-browser ./flamegraph.html
```
