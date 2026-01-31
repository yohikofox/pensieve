// Test file with discouraged practices

function badPractice1() {
  throw new Error("This is discouraged");
}

function badPractice2() {
  try {
    doSomething();
  } catch (error) {
    console.log(error);
  }
}

function okPractice() {
  console.log('[TestComponent] This is OK with prefix');
}
