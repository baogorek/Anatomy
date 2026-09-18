// Diagnostic interposer for the installed Linux OpenSim 4.6 wheel only.
// Equivalent source fix: invalidate Point's caches in PathWrapPoint::setLocation.
// No model file or installed library is changed.
#include <dlfcn.h>
#include <cstdio>
#include <cstdlib>
#include <string>
static unsigned long calls = 0;
static void* symbol(const char* name) {
    void* handle = dlopen("libosimSimulation.so", RTLD_LAZY | RTLD_NOLOAD);
    void* result = handle ? dlsym(handle, name) : nullptr;
    if (!result) { std::fprintf(stderr, "Missing diagnostic symbol: %s\n", name); std::abort(); }
    return result;
}
extern "C" void set_location(const void*, const void*, const void*)
    asm("_ZNK7OpenSim13PathWrapPoint11setLocationERKN5SimTK5StateERKNS1_3VecILi3EdLi1EEE");
extern "C" void set_location(const void* self, const void* state, const void* loc) {
    using Set = void (*)(const void*, const void*, const void*);
    using Invalidate = void (*)(const void*, const void*, const std::string&);
    static auto original = reinterpret_cast<Set>(symbol("_ZNK7OpenSim13PathWrapPoint11setLocationERKN5SimTK5StateERKNS1_3VecILi3EdLi1EEE"));
    static auto invalidate = reinterpret_cast<Invalidate>(symbol("_ZNK7OpenSim9Component24markCacheVariableInvalidERKN5SimTK5StateERKNSt7__cxx1112basic_stringIcSt11char_traitsIcESaIcEEE"));
    original(self, state, loc);
    // The single-inheritance base pointer equivalence was checked through SWIG.
    for (const auto* name : {"location", "velocity", "acceleration"}) invalidate(self, state, std::string(name));
    ++calls;
}
__attribute__((destructor)) static void count_calls() {
    std::fprintf(stderr, "Diagnostic wrap cache invalidations: %lu\n", calls);
}
